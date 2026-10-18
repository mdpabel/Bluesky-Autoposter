import OpenAI from 'openai'
import { formatBlueskyPost, getBlueskyBodyBudget } from './post-text'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const DEFAULT_MODEL = 'gpt-5.6-terra'

export async function generateBlueskyPost(
  title: string,
  snippet: string | undefined,
  url: string
): Promise<string> {
  const bodyBudget = getBlueskyBodyBudget(url)
  const model = process.env.OPENAI_POST_MODEL?.trim() || DEFAULT_MODEL

  try {
    const response = await client.responses.create({
      model,
      instructions: `You write concise Bluesky posts for MD Pabel, a WordPress security and malware-removal specialist. The business goal is to earn trust from site owners, agencies, and businesses that may need expert help.

Write a search-aware, issue-led social post that:
- opens with the exact symptom, risk, or costly mistake the target reader recognizes
- naturally uses the primary topic and specific WordPress or security terms people search for; never keyword-stuff
- accurately reflects whether the source is a blog, case study, guide, or malware research article
- gives one useful diagnostic distinction or takeaway from the source
- uses only evidence present in the title or excerpt; never invent results, numbers, or experience
- never adds frequency claims such as "most", "many", or "usually" unless that exact claim is supported by the source
- ends with a low-pressure reason to read, not a sales pitch
- avoids generic hooks, hype, emojis, quotation marks, and phrases such as "game changer", "unlock", or "click here"
- uses no more than one highly relevant hashtag, and only if space allows
- uses at most two short sentences
- obeys a hard limit of ${bodyBudget} characters; count and shorten the draft before responding

Return only the post body. Do not include the URL; the application adds it safely.`,
      input: `Article title: ${title}\nArticle excerpt: ${snippet?.trim() || '(No excerpt available; rely only on the title.)'}`,
      reasoning: { effort: 'none' },
      max_output_tokens: 220,
    })

    const body = response.output_text.trim()
    if (!body) throw new Error('OpenAI returned an empty caption')

    return formatBlueskyPost(body, url)
  } catch (error) {
    console.warn(
      `[openai] Caption generation failed; using safe title fallback: ${error instanceof Error ? error.message : String(error)}`,
    )
    return formatBlueskyPost(title, url)
  }
}
