import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateBlueskyPost(
  title: string,
  snippet: string | undefined,
  url: string
): Promise<string> {
  const { choices } = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You write Bluesky posts for a developer blog. Strict rules:
- Total post length must be ≤ 270 characters (count every character including spaces and the URL)
- Start with one strong, curiosity-driving hook sentence
- Optionally add 0–2 relevant hashtags on a separate line
- End with the article URL on its own final line
- Output ONLY the post text, no explanations or quotes`,
      },
      {
        role: 'user',
        content: `Title: ${title}\nExcerpt: ${snippet ?? '(none)'}\nURL: ${url}`,
      },
    ],
    max_tokens: 120,
    temperature: 0.7,
  })

  const text = choices[0].message.content?.trim()
  // Fallback: title + URL if model returns nothing
  return text ?? `${title}\n\n${url}`
}
