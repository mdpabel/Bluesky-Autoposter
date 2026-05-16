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

function isWrongType(err: unknown): boolean {
  return err instanceof Error && err.message.includes('WRONGTYPE')
}

export async function hasBeenPosted(guid: string): Promise<boolean> {
  try {
    const result = await redis.sismember(POSTED_KEY, guid)
    return result === 1
  } catch (err) {
    if (isWrongType(err)) {
      await redis.del(POSTED_KEY)
      return false
    }
    throw err
  }
}

export async function markAsPosted(guid: string): Promise<void> {
  try {
    await redis.sadd(POSTED_KEY, guid)
  } catch (err) {
    if (isWrongType(err)) {
      await redis.del(POSTED_KEY)
      await redis.sadd(POSTED_KEY, guid)
      return
    }
    throw err
  }
}

export async function getPostedGuids(): Promise<string[]> {
  try {
    return (await redis.smembers(POSTED_KEY)) as string[]
  } catch (err) {
    if (isWrongType(err)) {
      await redis.del(POSTED_KEY)
      return []
    }
    throw err
  }
}

export async function recordPost(record: PostRecord): Promise<void> {
  try {
    await redis.zadd(HISTORY_KEY, { score: record.timestamp, member: JSON.stringify(record) })
    await redis.zremrangebyrank(HISTORY_KEY, 0, -201)
  } catch (err) {
    if (isWrongType(err)) {
      await redis.del(HISTORY_KEY)
      await redis.zadd(HISTORY_KEY, { score: record.timestamp, member: JSON.stringify(record) })
      return
    }
    throw err
  }
}

export async function getHistory(limit = 50): Promise<PostRecord[]> {
  try {
    const raw = await redis.zrange(HISTORY_KEY, 0, limit - 1, { rev: true })
    return (raw as unknown[]).flatMap((r) => {
      if (typeof r === 'object' && r !== null) return [r as PostRecord]
      if (typeof r === 'string') {
        try {
          return [JSON.parse(r) as PostRecord]
        } catch {
          return []
        }
      }
      return []
    })
  } catch (err) {
    if (isWrongType(err)) {
      await redis.del(HISTORY_KEY)
      return []
    }
    throw err
  }
}
