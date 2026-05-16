import { BskyAgent, RichText } from '@atproto/api'
import sharp from 'sharp'

interface OgCard {
  title: string
  description: string
  imageUrl: string
}

async function fetchImageBuffer(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  // cms.mdpabel.com uses a self-signed cert; temporarily disable TLS verification for this fetch only
  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      mimeType: res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg',
    }
  } catch {
    return null
  } finally {
    if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev
  }
}

async function fetchOgCard(url: string): Promise<OgCard> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Bluesky-Bot/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()

    const meta = (property: string): string => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'),
      ]
      for (const re of patterns) {
        const m = html.match(re)
        if (m?.[1]) return m[1]
      }
      return ''
    }

    const rawImage = meta('og:image') || meta('twitter:image') || ''
    const imageUrl = rawImage
      ? new URL(rawImage, url).href  // resolve relative URLs against the article URL
      : ''

    return {
      title: meta('og:title') || meta('twitter:title') || url,
      description: meta('og:description') || meta('twitter:description') || '',
      imageUrl,
    }
  } catch {
    return { title: url, description: '', imageUrl: '' }
  }
}

export async function postToBluesky(
  text: string,
  url: string
): Promise<{ uri: string; bskyUrl: string }> {
  const agent = new BskyAgent({ service: 'https://bsky.social' })
  await agent.login({
    identifier: process.env.BLUESKY_IDENTIFIER!,
    password: process.env.BLUESKY_APP_PASSWORD!,
  })

  const rt = new RichText({ text })
  await rt.detectFacets(agent)

  const card = await fetchOgCard(url)

  const BSKY_MAX_BYTES = 950_000 // stay safely under Bluesky's 1 MB blob limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let thumb: any
  if (card.imageUrl) {
    try {
      const img = await fetchImageBuffer(card.imageUrl)
      if (img) {
        let { buffer, mimeType } = img

        if (buffer.byteLength > BSKY_MAX_BYTES) {
          buffer = await sharp(buffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer()
          mimeType = 'image/jpeg'
        }

        const { data } = await agent.uploadBlob(new Uint8Array(buffer), { encoding: mimeType })
        thumb = data.blob
      }
    } catch {
      // thumb is optional — skip silently
    }
  }

  const { uri } = await agent.post({
    text: rt.text,
    facets: rt.facets,
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: url,
        title: card.title,
        description: card.description,
        ...(thumb ? { thumb } : {}),
      },
    },
  })

  // AT URI: at://did:plc:xxx/app.bsky.feed.post/rkey
  const rkey = uri.split('/').pop()!
  const handle = process.env.BLUESKY_IDENTIFIER!
  const bskyUrl = `https://bsky.app/profile/${handle}/post/${rkey}`

  return { uri, bskyUrl }
}
