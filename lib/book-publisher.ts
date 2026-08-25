import {
  BOOK_PROMOTION_URL,
  BookContentRecord,
  rankBookContentCandidates,
} from '@/lib/book-content'
import { postTextToBluesky, postToBluesky } from '@/lib/bluesky'
import {
  getBookDayState,
  getPostedBookIds,
  markBookContentPosted,
  recordPost,
  releaseBookContentReservation,
  reserveBookContent,
} from '@/lib/redis'

export interface BookPublishResult {
  record: BookContentRecord
  bskyUrl: string
}

export async function publishNextBookContent({
  dateKey,
  seed,
}: {
  dateKey: string
  seed: string
}): Promise<BookPublishResult | null> {
  const [postedIds, dayState] = await Promise.all([
    getPostedBookIds(),
    getBookDayState(dateKey),
  ])

  const candidates = rankBookContentCandidates({
    postedIds,
    seed,
    excludedChapters: dayState.chapters,
    allowPromotional: !dayState.hasPromotion,
  })

  let record: BookContentRecord | undefined
  for (const candidate of candidates) {
    if (await reserveBookContent(candidate.id)) {
      record = candidate
      break
    }
  }

  if (!record) return null

  const now = Date.now()
  const hasBookLink = record.promotion !== 'value'
  try {
    const posted = hasBookLink
      ? await postToBluesky(record.post, BOOK_PROMOTION_URL, {
          title: 'WordPress Malware Removal for Developers & Site Owners',
          description: 'A practical investigation and recovery guide by MD Pabel.',
        })
      : await postTextToBluesky(record.post)

    await markBookContentPosted(record, dateKey)
    await recordPost({
      guid: `book:${record.id}`,
      contentId: record.id,
      source: 'book',
      title: record.hook,
      url: hasBookLink ? BOOK_PROMOTION_URL : undefined,
      text: record.post,
      promotion: record.promotion,
      bskyUrl: posted.bskyUrl,
      status: 'posted',
      timestamp: now,
    })
    return { record, bskyUrl: posted.bskyUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await releaseBookContentReservation(record.id).catch(() => undefined)
    await recordPost({
      guid: `book:${record.id}`,
      contentId: record.id,
      source: 'book',
      title: record.hook,
      url: hasBookLink ? BOOK_PROMOTION_URL : undefined,
      text: record.post,
      promotion: record.promotion,
      status: 'failed',
      timestamp: now,
      error: message,
    }).catch(() => undefined)
    throw error
  }
}
