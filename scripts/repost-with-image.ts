import {
  AppBskyEmbedExternal,
  AppBskyFeedPost,
  BskyAgent,
} from '@atproto/api'
import { postToBluesky } from '../lib/bluesky'
import { recordPost } from '../lib/redis'
import { fetchFeedItems } from '../lib/rss'

async function main() {
  const oldRkey = process.argv[2]?.trim()
  if (!oldRkey || !/^[a-z0-9]+$/i.test(oldRkey)) {
    throw new Error('Usage: npm run repost-with-image -- <post-rkey>')
  }

  const agent = new BskyAgent({ service: 'https://bsky.social' })
  await agent.login({
    identifier: process.env.BLUESKY_IDENTIFIER!,
    password: process.env.BLUESKY_APP_PASSWORD!,
  })

  const repo = agent.session?.did
  if (!repo) throw new Error('Bluesky login did not return an account DID')

  const oldUri = `at://${repo}/app.bsky.feed.post/${oldRkey}`
  const current = await agent.com.atproto.repo.getRecord({
    repo,
    collection: 'app.bsky.feed.post',
    rkey: oldRkey,
  })
  const record = current.data.value

  if (!AppBskyFeedPost.isRecord(record) || !AppBskyEmbedExternal.isMain(record.embed)) {
    throw new Error(`Post ${oldRkey} does not contain an external link card`)
  }

  const articleUrl = record.embed.external.uri
  const feedItems = await fetchFeedItems()
  const item = feedItems.find(({ link }) => link === articleUrl)
  if (!item) throw new Error(`Article is no longer present in the RSS feed: ${articleUrl}`)

  // Create and verify the corrected post before removing the existing one.
  const replacement = await postToBluesky(record.text, articleUrl, {
    title: item.title,
    description: item.contentSnippet,
  })
  const newRkey = replacement.uri.split('/').pop()!
  const created = await agent.com.atproto.repo.getRecord({
    repo,
    collection: 'app.bsky.feed.post',
    rkey: newRkey,
  })

  if (
    !AppBskyFeedPost.isRecord(created.data.value) ||
    !AppBskyEmbedExternal.isMain(created.data.value.embed) ||
    !created.data.value.embed.external.thumb
  ) {
    throw new Error(`Replacement ${replacement.uri} was created without a thumbnail; old post was preserved`)
  }

  await recordPost({
    guid: item.guid,
    title: item.title,
    url: item.link,
    bskyUrl: replacement.bskyUrl,
    status: 'posted',
    timestamp: Date.now(),
  })
  await agent.deletePost(oldUri)

  console.log(`Created and verified ${replacement.bskyUrl}`)
  console.log(`Removed image-less post ${oldUri}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
