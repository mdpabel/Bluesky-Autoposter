import assert from 'node:assert/strict'
import test from 'node:test'
import { BOOK_CONTENT, rankBookContentCandidates } from '../lib/book-content'
import { BLUESKY_MAX_GRAPHEMES, countGraphemes } from '../lib/post-text'

test('ships all 204 reviewed book records', () => {
  assert.equal(BOOK_CONTENT.length, 204)
  assert.equal(new Set(BOOK_CONTENT.map((record) => record.id)).size, 204)
  assert.equal(new Set(BOOK_CONTENT.map((record) => record.post)).size, 204)
})

test('every book post fits the Bluesky grapheme limit', () => {
  for (const record of BOOK_CONTENT) {
    assert.ok(countGraphemes(record.post) <= BLUESKY_MAX_GRAPHEMES, record.id)
  }
})

test('selector excludes posted records and avoids a chapter when possible', () => {
  const ranked = rankBookContentCandidates({
    postedIds: ['wmr-001'],
    excludedChapters: [1],
    allowPromotional: false,
    seed: 'test-seed',
  })

  assert.ok(ranked.length > 0)
  assert.ok(ranked.every((record) => record.id !== 'wmr-001'))
  assert.ok(ranked.every((record) => record.chapter !== 1))
  assert.ok(ranked.every((record) => record.promotion === 'value'))
})

test('selector order is deterministic for the same seed', () => {
  const options = { postedIds: [], seed: 'same-seed' }
  const first = rankBookContentCandidates(options).slice(0, 10).map((record) => record.id)
  const second = rankBookContentCandidates(options).slice(0, 10).map((record) => record.id)
  assert.deepEqual(first, second)
})
