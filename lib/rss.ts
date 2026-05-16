import Parser from 'rss-parser'

const parser = new Parser()

export interface FeedItem {
  guid: string
  title: string
  link: string
  contentSnippet?: string
}

export async function fetchFeedItems(): Promise<FeedItem[]> {
  const feed = await parser.parseURL('https://www.mdpabel.com/rss.xml')
  return feed.items
    .filter((item): item is typeof item & { guid: string; title: string; link: string } =>
      Boolean(item.guid && item.title && item.link)
    )
    .map((item) => ({
      guid: item.guid,
      title: item.title,
      link: item.link,
      contentSnippet: item.contentSnippet,
    }))
}
