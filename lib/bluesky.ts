import { BskyAgent, RichText } from '@atproto/api'
import sharp from 'sharp'
import {
  BLUESKY_MAX_GRAPHEMES,
  countGraphemes,
  formatBlueskyPost,
} from './post-text'

const BLUESKY_MAX_BLOB_BYTES = 950_000
const FETCH_ATTEMPTS = 2
const FETCH_TIMEOUT_MS = 10_000

export const PROMOTION_REPLY_TEXT = [
  'WordPress Malware Removal Service:',
  'https://www.mdpabel.com/wordpress-malware-removal/',
  '',
  'WordPress Malware Removal Book:',
  'https://www.mdpabel.com/books/wordpress-malware-removal/',
].join('\n')

export interface LinkCardFallback {
  title: string
  description?: string
}

export interface PreparedLinkCard {
  title: string
  description: string
  imageUrl: string
  thumbnail: Buffer
  mimeType: 'image/jpeg'
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

async function fetchWithRetry(url: string, accept: string): Promise<Response> {
  let lastError: unknown

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: accept,
          'User-Agent': 'Mozilla/5.0 (compatible; MDPabel-Bluesky-Autoposter/1.0)',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response
    } catch (error) {
      lastError = error
      if (attempt < FETCH_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`Failed to fetch ${url} after ${FETCH_ATTEMPTS} attempts: ${detail}`)
}

function getMetaContent(html: string, property: string): string {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapedProperty}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedProperty}["']`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeHtmlEntities(match[1].trim())
  }

  return ''
}

async function fetchCardMetadata(url: string, fallback: LinkCardFallback) {
  const response = await fetchWithRetry(url, 'text/html,application/xhtml+xml')
  const html = await response.text()
  const rawImage = getMetaContent(html, 'og:image') || getMetaContent(html, 'twitter:image')

  if (!rawImage) {
    throw new Error(`No featured image metadata found at ${url}`)
  }

  return {
    title: getMetaContent(html, 'og:title') || getMetaContent(html, 'twitter:title') || fallback.title,
    description:
      getMetaContent(html, 'og:description') ||
      getMetaContent(html, 'twitter:description') ||
      fallback.description ||
      '',
    imageUrl: new URL(rawImage, url).href,
  }
}

async function downloadThumbnail(imageUrl: string): Promise<Buffer> {
  const response = await fetchWithRetry(imageUrl, 'image/avif,image/webp,image/png,image/jpeg,image/*')
  const contentType = response.headers.get('content-type')?.split(';')[0].toLowerCase() || ''
  if (!contentType.startsWith('image/')) {
    throw new Error(`Featured image returned unsupported content type: ${contentType || 'unknown'}`)
  }

  const source = Buffer.from(await response.arrayBuffer())
  let thumbnail = await sharp(source)
    .rotate()
    .resize({ width: 1200, height: 630, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer()

  if (thumbnail.byteLength > BLUESKY_MAX_BLOB_BYTES) {
    thumbnail = await sharp(source)
      .rotate()
      .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 68, progressive: true })
      .toBuffer()
  }

  if (thumbnail.byteLength > BLUESKY_MAX_BLOB_BYTES) {
    throw new Error(`Featured image is still too large after optimization: ${thumbnail.byteLength} bytes`)
  }

  return thumbnail
}

export async function prepareLinkCard(
  url: string,
  fallback: LinkCardFallback,
): Promise<PreparedLinkCard> {
  const card = await fetchCardMetadata(url, fallback)
  const thumbnail = await downloadThumbnail(card.imageUrl)

  return {
    ...card,
    thumbnail,
    mimeType: 'image/jpeg',
  }
}

export async function postToBluesky(
  text: string,
  url: string,
  fallback: LinkCardFallback,
): Promise<{ uri: string; bskyUrl: string; replyUri: string }> {
  const safeText = formatBlueskyPost(text, url)
  const agent = new BskyAgent({ service: 'https://bsky.social' })

  const [, card] = await Promise.all([
    agent.login({
      identifier: process.env.BLUESKY_IDENTIFIER!,
      password: process.env.BLUESKY_APP_PASSWORD!,
    }),
    prepareLinkCard(url, fallback),
  ])

  const rt = new RichText({ text: safeText })
  await rt.detectFacets(agent)

  // A featured image is mandatory. Any failure above aborts the post so the next run can retry.
  const { data } = await agent.uploadBlob(new Uint8Array(card.thumbnail), {
    encoding: card.mimeType,
  })

  const { uri, cid } = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: url,
        title: card.title,
        description: card.description,
        thumb: data.blob,
      },
    },
  })

  let replyUri: string
  try {
    const reply = new RichText({ text: PROMOTION_REPLY_TEXT })
    await reply.detectFacets(agent)
    const result = await agent.post({
      text: reply.text,
      facets: reply.facets,
      reply: {
        root: { uri, cid },
        parent: { uri, cid },
      },
    })
    replyUri = result.uri
  } catch (error) {
    // Keep publishing atomic: remove the new root post so a later retry cannot duplicate it.
    try {
      await agent.deletePost(uri)
    } catch (rollbackError) {
      const publishMessage = error instanceof Error ? error.message : String(error)
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      throw new Error(`Promotion reply failed (${publishMessage}) and root-post rollback failed (${rollbackMessage})`)
    }
    throw error
  }

  const rkey = uri.split('/').pop()!
  const handle = process.env.BLUESKY_IDENTIFIER!
  const bskyUrl = `https://bsky.app/profile/${handle}/post/${rkey}`

  return { uri, bskyUrl, replyUri }
}

export async function postTextToBluesky(
  text: string,
): Promise<{ uri: string; bskyUrl: string }> {
  const safeText = text.trim()
  if (!safeText) throw new Error('Cannot publish an empty Bluesky post')
  if (countGraphemes(safeText) > BLUESKY_MAX_GRAPHEMES) {
    throw new Error(`Book post exceeds ${BLUESKY_MAX_GRAPHEMES} graphemes`)
  }

  const agent = new BskyAgent({ service: 'https://bsky.social' })
  await agent.login({
    identifier: process.env.BLUESKY_IDENTIFIER!,
    password: process.env.BLUESKY_APP_PASSWORD!,
  })

  const richText = new RichText({ text: safeText })
  await richText.detectFacets(agent)
  const { uri } = await agent.post({
    text: richText.text,
    facets: richText.facets,
  })

  const rkey = uri.split('/').pop()!
  const handle = process.env.BLUESKY_IDENTIFIER!
  return {
    uri,
    bskyUrl: `https://bsky.app/profile/${handle}/post/${rkey}`,
  }
}
