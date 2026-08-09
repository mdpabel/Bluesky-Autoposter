import { generateBlueskyPost } from '../lib/openai'
import { countGraphemes } from '../lib/post-text'
import { fetchFeedItems } from '../lib/rss'

async function main() {
  const query = process.argv.slice(2).join(' ').trim().toLowerCase()
  const items = await fetchFeedItems()
  const item = query
    ? items.find(({ title }) => title.toLowerCase().includes(query))
    : items[0]

  if (!item) {
    throw new Error(`No RSS article matched "${query}"`)
  }

  const post = await generateBlueskyPost(item.title, item.contentSnippet, item.link)

  console.log(`Article: ${item.title}`)
  console.log(`Graphemes: ${countGraphemes(post)}/300`)
  console.log('---')
  console.log(post)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
