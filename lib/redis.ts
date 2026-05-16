import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const POSTED_KEY = 'bluesky:posted_guids'
const HISTORY_KEY = 'bluesky:history'

export interface PostRecord {
  guid: string
  title: string
  url: string
  bskyUrl?: string
  status: 'posted' | 'failed'
  timestamp: number
  error?: string
}

export async function hasBeenPosted(guid: string): Promise<boolean> {
  const result = await redis.sismember(POSTED_KEY, guid)
  return result === 1
}

export async function markAsPosted(guid: string): Promise<void> {
  await redis.sadd(POSTED_KEY, guid)
}

export async function getPostedGuids(): Promise<string[]> {
  return redis.smembers(POSTED_KEY) as Promise<string[]>
}

export async function recordPost(record: PostRecord): Promise<void> {
  await redis.zadd(HISTORY_KEY, { score: record.timestamp, member: JSON.stringify(record) })
  // Keep only the newest 200 records
  await redis.zremrangebyrank(HISTORY_KEY, 0, -201)
}

export async function getHistory(limit = 50): Promise<PostRecord[]> {
  const raw = await redis.zrange(HISTORY_KEY, 0, limit - 1, { rev: true })
  return (raw as string[]).flatMap((r) => {
    try {
      return [JSON.parse(r) as PostRecord]
    } catch {
      return []
    }
  })
}
