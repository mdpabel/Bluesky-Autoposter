import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BOOK_CRON_SLOTS,
  getActiveBookSlots,
  getBookPostsPerDay,
  getDhakaDateKey,
} from '../lib/book-schedule'

test('defaults to two posts and accepts only three as the override', () => {
  assert.equal(getBookPostsPerDay(undefined), 2)
  assert.equal(getBookPostsPerDay('2'), 2)
  assert.equal(getBookPostsPerDay('3'), 3)
  assert.equal(getBookPostsPerDay('20'), 2)
})

test('selects two separated daily windows deterministically', () => {
  const first = getActiveBookSlots('2026-08-25', 2, 'test-seed')
  const second = getActiveBookSlots('2026-08-25', 2, 'test-seed')
  assert.deepEqual(first, second)
  assert.equal(first.length, 2)

  const indices = first.map((id) => BOOK_CRON_SLOTS.findIndex((slot) => slot.id === id))
  assert.ok(indices.some((index) => index <= 2))
  assert.ok(indices.some((index) => index >= 3))
})

test('selects one window from each part of the day for three posts', () => {
  const slots = getActiveBookSlots('2026-08-25', 3, 'test-seed')
  const indices = slots.map((id) => BOOK_CRON_SLOTS.findIndex((slot) => slot.id === id))
  assert.equal(slots.length, 3)
  assert.ok(indices.some((index) => index <= 1))
  assert.ok(indices.some((index) => index >= 2 && index <= 3))
  assert.ok(indices.some((index) => index >= 4))
})

test('uses the Dhaka calendar date', () => {
  assert.equal(getDhakaDateKey(new Date('2026-08-24T19:30:00Z')), '2026-08-25')
})
