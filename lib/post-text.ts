export const BLUESKY_MAX_GRAPHEMES = 300

// Leave a small margin so future formatting changes cannot push a post over the API limit.
const BLUESKY_TARGET_GRAPHEMES = 295
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

function graphemes(value: string): string[] {
  return Array.from(segmenter.segment(value), ({ segment }) => segment)
}

export function countGraphemes(value: string): number {
  return graphemes(value).length
}

function cleanModelText(value: string, url: string): string {
  return value
    .replace(/```[a-z]*\s*/gi, '')
    .replace(/```/g, '')
    .split(url)
    .join('')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim()
}

function truncateAtWord(value: string, maxGraphemes: number): string {
  const parts = graphemes(value)
  if (parts.length <= maxGraphemes) return value
  if (maxGraphemes <= 1) return parts.slice(0, maxGraphemes).join('')

  const candidate = parts.slice(0, maxGraphemes - 1).join('').trimEnd()
  const sentenceMatches = Array.from(candidate.matchAll(/[.!?](?=\s|$)/g))
  const lastSentenceEnd = sentenceMatches.at(-1)?.index
  if (lastSentenceEnd !== undefined && lastSentenceEnd >= Math.floor(candidate.length * 0.5)) {
    return candidate.slice(0, lastSentenceEnd + 1)
  }

  const lastSpace = candidate.lastIndexOf(' ')
  const shortened = lastSpace >= Math.floor(candidate.length * 0.65)
    ? candidate.slice(0, lastSpace)
    : candidate

  return `${shortened.replace(/[,:;.!?\-–—]+$/u, '')}…`
}

export function getBlueskyBodyBudget(url: string): number {
  return Math.max(0, BLUESKY_TARGET_GRAPHEMES - countGraphemes(url) - 2)
}

export function formatBlueskyPost(body: string, url: string): string {
  const normalizedUrl = url.trim()
  if (!normalizedUrl) throw new Error('Cannot format a Bluesky post without a URL')

  const bodyBudget = getBlueskyBodyBudget(normalizedUrl)
  const cleanBody = cleanModelText(body, normalizedUrl) || 'A practical WordPress fix worth saving.'
  const finalBody = truncateAtWord(cleanBody, bodyBudget)
  const post = finalBody ? `${finalBody}\n\n${normalizedUrl}` : normalizedUrl

  if (countGraphemes(post) > BLUESKY_MAX_GRAPHEMES) {
    throw new Error('The article URL is too long for a Bluesky post')
  }

  return post
}
