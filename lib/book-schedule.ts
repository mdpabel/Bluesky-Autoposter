import { createHash } from 'node:crypto'

export const BOOK_TIME_ZONE = 'Asia/Dhaka'

export const BOOK_CRON_SLOTS = [
  { id: '09-bdt', utcHour: 3, localLabel: '09:00–09:59 BDT' },
  { id: '11-bdt', utcHour: 5, localLabel: '11:00–11:59 BDT' },
  { id: '13-bdt', utcHour: 7, localLabel: '13:00–13:59 BDT' },
  { id: '15-bdt', utcHour: 9, localLabel: '15:00–15:59 BDT' },
  { id: '17-bdt', utcHour: 11, localLabel: '17:00–17:59 BDT' },
  { id: '21-bdt', utcHour: 15, localLabel: '21:00–21:59 BDT' },
] as const

export type BookSlotId = (typeof BOOK_CRON_SLOTS)[number]['id']

export function getBookPostsPerDay(value = process.env.BOOK_POSTS_PER_DAY): 2 | 3 {
  return value?.trim() === '3' ? 3 : 2
}

export function getDhakaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function choose<T>(values: readonly T[], seed: string): T {
  const hash = createHash('sha256').update(seed).digest()
  return values[hash.readUInt32BE(0) % values.length]
}

export function getActiveBookSlots(
  dateKey: string,
  postsPerDay = getBookPostsPerDay(),
  scheduleSeed = process.env.BOOK_SCHEDULE_SEED || process.env.CRON_SECRET || 'mdpabel-book',
): BookSlotId[] {
  const groups = postsPerDay === 3
    ? [BOOK_CRON_SLOTS.slice(0, 2), BOOK_CRON_SLOTS.slice(2, 4), BOOK_CRON_SLOTS.slice(4, 6)]
    : [BOOK_CRON_SLOTS.slice(0, 3), BOOK_CRON_SLOTS.slice(3, 6)]

  return groups.map((group, index) =>
    choose(group, `${scheduleSeed}:${dateKey}:${postsPerDay}:${index}`).id,
  )
}

export function isBookSlotId(value: string): value is BookSlotId {
  return BOOK_CRON_SLOTS.some((slot) => slot.id === value)
}

export function getBookSlotLabel(id: BookSlotId): string {
  return BOOK_CRON_SLOTS.find((slot) => slot.id === id)!.localLabel
}
