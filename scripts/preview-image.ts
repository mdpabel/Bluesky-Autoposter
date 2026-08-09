import sharp from 'sharp'
import { prepareLinkCard } from '../lib/bluesky'
import { fetchFeedItems } from '../lib/rss'

async function main() {
  const query = process.argv.slice(2).join(' ').trim().toLowerCase()
  const items = await fetchFeedItems()
  const item = query
    ? items.find(({ title }) => title.toLowerCase().includes(query))
    : items[0]

  if (!item) throw new Error(`No RSS article matched "${query}"`)

  const card = await prepareLinkCard(item.link, {
    title: item.title,
    description: item.contentSnippet,
  })
  const metadata = await sharp(card.thumbnail).metadata()

  console.log(`Article: ${item.title}`)
  console.log(`Card title: ${card.title}`)
  console.log(`Featured image: ${card.imageUrl}`)
  console.log(`Prepared thumbnail: ${metadata.width}x${metadata.height}, ${card.thumbnail.byteLength} bytes, ${card.mimeType}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
