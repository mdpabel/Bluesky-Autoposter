import { NextRequest, NextResponse } from 'next/server'
import { publishNextBookContent } from '@/lib/book-publisher'
import {
  getActiveBookSlots,
  getBookPostsPerDay,
  getDhakaDateKey,
  isBookSlotId,
} from '@/lib/book-schedule'
import { claimBookSlot, getBookDayState, releaseBookSlot } from '@/lib/redis'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slot: string }> },
) {
  const isDev = process.env.NODE_ENV === 'development'
  const auth = req.headers.get('authorization')

  if (!isDev && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slot } = await context.params
  if (!isBookSlotId(slot)) {
    return NextResponse.json({ error: `Unknown book-content slot: ${slot}` }, { status: 404 })
  }

  const dateKey = getDhakaDateKey()
  const postsPerDay = getBookPostsPerDay()
  const activeSlots = getActiveBookSlots(dateKey)
  if (!activeSlots.includes(slot)) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'inactive-random-slot',
      dateKey,
      postsPerDay,
      activeSlots,
    })
  }

  const dayState = await getBookDayState(dateKey)
  if (dayState.postedCount >= postsPerDay) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'daily-target-reached',
      dateKey,
      postsPerDay,
    })
  }

  if (!(await claimBookSlot(dateKey, slot))) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'slot-already-processed',
      dateKey,
      slot,
    })
  }

  try {
    const published = await publishNextBookContent({
      dateKey,
      seed: `${dateKey}:${slot}`,
    })

    if (!published) {
      return NextResponse.json({
        status: 'skipped',
        reason: 'content-library-exhausted',
        dateKey,
        slot,
      })
    }

    return NextResponse.json({
      status: 'posted',
      dateKey,
      slot,
      contentId: published.record.id,
      promotion: published.record.promotion,
      bskyUrl: published.bskyUrl,
    })
  } catch (error) {
    await releaseBookSlot(dateKey, slot).catch(() => undefined)
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[book-cron] Failed ${dateKey}/${slot}: ${message}`)
    return NextResponse.json({ error: message, dateKey, slot }, { status: 500 })
  }
}
