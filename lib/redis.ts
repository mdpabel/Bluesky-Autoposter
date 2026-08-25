import { Redis } from '@upstash/redis'
import type { BookContentRecord, BookPromotion } from './book-content'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const POSTED_KEY = 'bluesky:posted_guids'
const HISTORY_KEY = 'bluesky:history'
const BOOK_POSTED_KEY = 'bluesky:book:posted_ids'
const BOOK_RESERVATION_PREFIX = 'bluesky:book:reservation:'
const BOOK_SLOT_PREFIX = 'bluesky:book:slot:'
const BOOK_DAY_CHAPTERS_PREFIX = 'bluesky:book:day:chapters:'
const BOOK_DAY_POSTS_PREFIX = 'bluesky:book:day:posts:'
const BOOK_DAY_PROMOTION_PREFIX = 'bluesky:book:day:promotion:'
const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60

export interface PostRecord {
  guid: string
  contentId?: string
  source?: 'rss' | 'book'
  title: string
  url?: string
  text?: string
  promotion?: BookPromotion
  bskyUrl?: string
  status: 'posted' | 'failed'
  timestamp: number
  error?: string
}

export interface BookDayState {
  chapters: number[]
  hasPromotion: boolean
  postedCount: number
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

export async function getPostedBookIds(): Promise<string[]> {
  try {
    return (await redis.smembers(BOOK_POSTED_KEY)) as string[]
  } catch (err) {
    if (isWrongType(err)) {
      await redis.del(BOOK_POSTED_KEY)
      return []
    }
    throw err
  }
}

export async function reserveBookContent(id: string): Promise<boolean> {
  const result = await redis.set(`${BOOK_RESERVATION_PREFIX}${id}`, Date.now(), {
    nx: true,
    ex: 15 * 60,
  })
  return result === 'OK'
}

export async function releaseBookContentReservation(id: string): Promise<void> {
  await redis.del(`${BOOK_RESERVATION_PREFIX}${id}`)
}

export async function claimBookSlot(dateKey: string, slotId: string): Promise<boolean> {
  const result = await redis.set(`${BOOK_SLOT_PREFIX}${dateKey}:${slotId}`, Date.now(), {
    nx: true,
    ex: TWO_DAYS_SECONDS,
  })
  return result === 'OK'
}

export async function releaseBookSlot(dateKey: string, slotId: string): Promise<void> {
  await redis.del(`${BOOK_SLOT_PREFIX}${dateKey}:${slotId}`)
}

export async function getBookDayState(dateKey: string): Promise<BookDayState> {
  const [rawChapters, rawPosts, promotion] = await Promise.all([
    redis.smembers(`${BOOK_DAY_CHAPTERS_PREFIX}${dateKey}`),
    redis.smembers(`${BOOK_DAY_POSTS_PREFIX}${dateKey}`),
    redis.exists(`${BOOK_DAY_PROMOTION_PREFIX}${dateKey}`),
  ])
  return {
    chapters: (rawChapters as string[]).map((value) => Number.parseInt(value, 10)),
    hasPromotion: promotion === 1,
    postedCount: (rawPosts as string[]).length,
  }
}

export async function markBookContentPosted(
  record: Pick<BookContentRecord, 'id' | 'chapter' | 'promotion'>,
  dateKey: string,
): Promise<void> {
  const chaptersKey = `${BOOK_DAY_CHAPTERS_PREFIX}${dateKey}`
  const postsKey = `${BOOK_DAY_POSTS_PREFIX}${dateKey}`
  const pipeline = redis.pipeline()
    .sadd(BOOK_POSTED_KEY, record.id)
    .sadd(chaptersKey, String(record.chapter))
    .expire(chaptersKey, TWO_DAYS_SECONDS)
    .sadd(postsKey, record.id)
    .expire(postsKey, TWO_DAYS_SECONDS)
    .del(`${BOOK_RESERVATION_PREFIX}${record.id}`)

  if (record.promotion !== 'value') {
    const promotionKey = `${BOOK_DAY_PROMOTION_PREFIX}${dateKey}`
    pipeline.set(promotionKey, record.id, { ex: TWO_DAYS_SECONDS })
  }

  await pipeline.exec()
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
