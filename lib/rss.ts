import Parser from 'rss-parser'

const parser = new Parser()
const FEED_URL = 'https://www.mdpabel.com/rss.xml'

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

export interface FeedItem {
  guid: string
  title: string
  link: string
  contentSnippet?: string
}

async function fetchFeedXml(): Promise<string> {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(FEED_URL, {
        headers: { 'User-Agent': 'MDPabel-Bluesky-Autoposter/1.0' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) throw new Error(`RSS returned HTTP ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('RSS request failed')
}

export async function fetchFeedItems(): Promise<FeedItem[]> {
  const feed = await parser.parseString(await fetchFeedXml())
  return feed.items
    .filter((item): item is typeof item & { guid: string; title: string; link: string } =>
      Boolean(item.guid && item.title && item.link)
    )
    .map((item) => ({
      guid: item.guid,
      title: decodeHtmlEntities(item.title),
      link: item.link,
      contentSnippet: item.contentSnippet ? decodeHtmlEntities(item.contentSnippet) : undefined,
    }))
}
