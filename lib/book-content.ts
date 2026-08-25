import { createHash } from 'node:crypto'
import catalog from '@/data/book-content/catalog.json'

export type BookPromotion = 'value' | 'soft' | 'direct'

export interface BookContentRecord {
  id: string
  bookId: string
  chapter: number
  chapterTitle: string
  chapterSlug: string
  sourceFile: string
  sourceSection: string
  contentType: string
  audience: string
  topic: string
  hook: string
  body: string
  post: string
  graphemeCount: number
  promotion: BookPromotion
  tags: string[]
  contentHash: string
}

export const BOOK_CONTENT = catalog as BookContentRecord[]
export const BOOK_PROMOTION_URL =
  process.env.BOOK_PROMOTION_URL?.trim() ||
  'https://www.mdpabel.com/wordpress-malware-removal-book/'

function rank(seed: string, id: string): string {
  return createHash('sha256').update(`${seed}:${id}`).digest('hex')
}

export function rankBookContentCandidates({
  postedIds,
  seed,
  excludedChapters = [],
  allowPromotional = true,
}: {
  postedIds: Iterable<string>
  seed: string
  excludedChapters?: Iterable<number>
  allowPromotional?: boolean
}): BookContentRecord[] {
  const posted = new Set(postedIds)
  const excluded = new Set(excludedChapters)
  const available = BOOK_CONTENT.filter(
    (record) =>
      !posted.has(record.id) &&
      (allowPromotional || record.promotion === 'value'),
  )

  const diverse = available.filter((record) => !excluded.has(record.chapter))
  const candidates = diverse.length > 0 ? diverse : available

  return candidates.toSorted((left, right) =>
    rank(seed, left.id).localeCompare(rank(seed, right.id)),
  )
}

export function getBookContent(id: string): BookContentRecord | undefined {
  return BOOK_CONTENT.find((record) => record.id === id)
}
