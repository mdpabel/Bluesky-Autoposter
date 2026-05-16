'use server'

import { revalidatePath } from 'next/cache'
import { fetchFeedItems } from '@/lib/rss'
import { generateBlueskyPost } from '@/lib/openai'
import { postToBluesky } from '@/lib/bluesky'
import { hasBeenPosted, markAsPosted, recordPost } from '@/lib/redis'

export type RunResult = {
  posted: number
  skipped: number
  failed: number
  errors: string[]
}

export async function runNow(): Promise<RunResult> {
  const result: RunResult = { posted: 0, skipped: 0, failed: 0, errors: [] }
  const now = Date.now()

  let items
  try {
    items = await fetchFeedItems()
  } catch (err) {
    result.errors.push(`RSS fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    return result
  }

  for (const item of items) {
    if (await hasBeenPosted(item.guid)) {
      result.skipped++
      continue
    }
    try {
      const text = await generateBlueskyPost(item.title, item.contentSnippet, item.link)
      const { uri: _uri, bskyUrl } = await postToBluesky(text, item.link)
      await markAsPosted(item.guid)
      await recordPost({ guid: item.guid, title: item.title, url: item.link, bskyUrl, status: 'posted', timestamp: now })
      result.posted++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await recordPost({ guid: item.guid, title: item.title, url: item.link, status: 'failed', timestamp: now, error: msg })
      result.errors.push(`${item.title}: ${msg}`)
      result.failed++
    }
  }

  revalidatePath('/')
  return result
}
