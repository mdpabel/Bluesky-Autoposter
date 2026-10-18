# Bluesky Autoposter

Personal dashboard that publishes new [mdpabel.com](https://mdpabel.com) articles to Bluesky.

## Publishing

The RSS cron runs daily at **13:00 UTC**, finds the next unposted article, generates an issue-led caption, attaches its featured-image card, and records the result.

Book-content posting is stopped. The former book cron endpoint returns HTTP 410, the book schedules and manual button are removed, and the reviewed catalog remains in `data/book-content/catalog.json` for reference. Existing book posts remain visible in history.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Hosting + cron | Vercel |
| Persistence | Upstash Redis |
| RSS caption generation | OpenAI GPT-5.6 Terra (configurable) |
| Bluesky API | `@atproto/api` |
| Archived book content | Local reviewed JSON catalog (204 records) |

## Local setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Preview RSS-generated copy or validate a featured image without publishing:

```bash
npm run preview-post -- "part of an article title"
npm run preview-image -- "part of an article title"
```

## Environment variables

| Variable | Description |
|---|---|
| `BLUESKY_IDENTIFIER` | Bluesky handle or custom domain, such as `mdpabel.com` |
| `BLUESKY_APP_PASSWORD` | Bluesky app password |
| `OPENAI_API_KEY` | Used only for RSS article captions |
| `OPENAI_POST_MODEL` | Optional RSS caption model override |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `CRON_SECRET` | Private random string of at least 16 characters |
| `BASIC_AUTH_USER` | Dashboard login username |
| `BASIC_AUTH_PASSWORD` | Dashboard login password |

Add the variables in Vercel under **Settings → Environment Variables** before deploying.

## Dashboard

The dashboard shows post history and upcoming RSS articles.

- **Run Now** publishes the next RSS article.

## Cron configuration

`vercel.json` contains the RSS job. Redeploying removes the book jobs from the active Vercel deployment.

```text
RSS: 13:00 UTC daily
```

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to cron routes. Cron endpoints also work without that header in `NODE_ENV=development`.

## Project structure

```text
app/
  api/
    auth/login/                       POST - sets auth cookie
    auth/logout/                      POST - clears auth cookie
    cron/post-bluesky/                GET - RSS cron
    cron/post-book-content/[slot]/    GET - retired endpoint (HTTP 410)
  components/
    TriggerButton                     manual RSS post
  page.tsx                            RSS dashboard and post history
data/book-content/
  catalog.json                        archived reviewed 204-record database
  manifest.json                       source and count metadata
lib/
  bluesky.ts                          link-card and plain-text publishing
  book-content.ts                     archived catalog and selector
  book-publisher.ts                   retired book publishing workflow
  book-schedule.ts                    retired Dhaka window selection
  openai.ts                           RSS caption generation
  redis.ts                            history and deduplication
  rss.ts                              RSS feed fetching
middleware.ts                         dashboard auth guard
vercel.json                           RSS cron schedule
```
