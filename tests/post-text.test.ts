import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BLUESKY_MAX_GRAPHEMES,
  countGraphemes,
  formatBlueskyPost,
  getBlueskyBodyBudget,
} from '../lib/post-text'
import { PROMOTION_REPLY_TEXT } from '../lib/bluesky'

const url = 'https://www.mdpabel.com/blog/wordpress-malware-scan-clean-site-still-hacked/'

test('keeps a normal post and puts the URL on its own final line', () => {
  const body = 'A clean malware scan does not prove a WordPress site is clean.'
  const post = formatBlueskyPost(body, url)

  assert.equal(post, `${body}\n\n${url}`)
  assert.ok(countGraphemes(post) <= BLUESKY_MAX_GRAPHEMES)
})

test('truncates overlong model output at a word boundary', () => {
  const post = formatBlueskyPost('WordPress malware can hide outside the files your scanner checks. '.repeat(12), url)

  assert.ok(countGraphemes(post) <= 295)
  assert.ok(post.endsWith(`\n\n${url}`))
  assert.match(post, /[.…]\n\nhttps:/)
})

test('counts emoji as graphemes rather than UTF-16 code units', () => {
  const familyEmoji = '👨‍👩‍👧‍👦'
  assert.equal(countGraphemes(familyEmoji), 1)

  const post = formatBlueskyPost(familyEmoji.repeat(400), url)
  assert.ok(countGraphemes(post) <= 295)
})

test('removes a model-supplied URL before appending one canonical copy', () => {
  const post = formatBlueskyPost(`Check these three layers.\n${url}`, url)

  assert.equal(post.match(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length, 1)
  assert.ok(post.endsWith(url))
})

test('calculates the body budget from the actual URL length', () => {
  assert.equal(
    getBlueskyBodyBudget(url),
    295 - countGraphemes(url) - countGraphemes('\n\n'),
  )
})

test('rejects a URL that cannot fit within Bluesky limits', () => {
  assert.throws(
    () => formatBlueskyPost('Body', `https://example.com/${'a'.repeat(300)}`),
    /URL is too long/,
  )
})

test('promotion reply contains the service and book links within the Bluesky limit', () => {
  assert.equal(
    PROMOTION_REPLY_TEXT,
    'WordPress Malware Removal Service:\nhttps://www.mdpabel.com/wordpress-malware-removal/\n\n' +
      'WordPress Malware Removal Book:\nhttps://www.mdpabel.com/books/wordpress-malware-removal/',
  )
  assert.ok(countGraphemes(PROMOTION_REPLY_TEXT) <= BLUESKY_MAX_GRAPHEMES)
})
