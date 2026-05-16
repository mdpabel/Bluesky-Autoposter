import { BskyAgent, RichText } from '@atproto/api'

interface OgCard {
  title: string
  description: string
  imageUrl: string
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

    return {
      title: meta('og:title') || meta('twitter:title') || url,
      description: meta('og:description') || meta('twitter:description') || '',
      imageUrl: meta('og:image') || meta('twitter:image') || '',
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let thumb: any
  if (card.imageUrl) {
    try {
      const imgRes = await fetch(card.imageUrl, { signal: AbortSignal.timeout(8000) })
      const buffer = new Uint8Array(await imgRes.arrayBuffer())
      const mimeType = imgRes.headers.get('content-type') ?? 'image/jpeg'
      const { data } = await agent.uploadBlob(buffer, { encoding: mimeType })
      thumb = data.blob
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
