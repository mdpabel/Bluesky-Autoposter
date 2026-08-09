# Bluesky Autoposter

Personal dashboard that automatically posts new [mdpabel.com](https://mdpabel.com) blog articles to Bluesky daily.

## How it works

1. A Vercel cron job fires every day at **13:00 UTC**
2. Fetches the RSS feed from `mdpabel.com/rss.xml`
3. Filters out articles already posted (tracked in Upstash Redis)
4. Generates an issue-led, search-friendly caption via GPT-5.6 Terra
5. Downloads and optimizes the article's featured image, then posts a complete link card via `@atproto/api`
6. Records the result to Redis history

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Hosting + cron | Vercel |
| Persistence | Upstash Redis |
| Caption gen | OpenAI GPT-5.6 Terra (configurable) |
| Bluesky API | `@atproto/api` |

## Local setup

```bash
npm install
cp .env.local.example .env.local   # fill in the values
npm run dev
```

Preview generated copy or validate a featured image without publishing:

```bash
npm run preview-post -- "part of an article title"
npm run preview-image -- "part of an article title"
```

## Environment variables

| Variable | Description |
|---|---|
| `BLUESKY_IDENTIFIER` | Your Bluesky handle or custom domain (e.g. `mdpabel.com`) |
| `BLUESKY_APP_PASSWORD` | Bluesky app password |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_POST_MODEL` | Optional model override (defaults to `gpt-5.6-terra`) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `CRON_SECRET` | Random secret — Vercel sends this as `Authorization: Bearer <secret>` |
| `BASIC_AUTH_USER` | Dashboard login username |
| `BASIC_AUTH_PASSWORD` | Dashboard login password |

Add all of these in Vercel → **Settings → Environment Variables** before deploying.

## Dashboard

The UI at `/` shows post history, upcoming articles, and live stats. A **Run Now** button lets you trigger a post on demand.

Access is protected by a login page. Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` in your env vars. The session is stored as an httpOnly cookie valid for 30 days. Search engine indexing is disabled via `robots.txt` and `X-Robots-Tag` headers.

## Cron

Configured in `vercel.json`:

```json
{ "path": "/api/cron/post-bluesky", "schedule": "0 13 * * *" }
```

Vercel automatically injects `Authorization: Bearer <CRON_SECRET>` on each call. The endpoint also works unauthenticated in `NODE_ENV=development`.

## Project structure

```
app/
  api/
    auth/login/     POST — sets auth cookie
    auth/logout/    POST — clears auth cookie
    cron/post-bluesky/  GET — main cron job
  components/
    TriggerButton   Run Now button
    LogoutButton    Sign out button
  login/            Login page
  page.tsx          Dashboard
lib/
  auth.ts           Auth token helpers
  bluesky.ts        Bluesky post logic
  openai.ts         Caption generation
  redis.ts          Post history + deduplication
  rss.ts            RSS feed fetching
middleware.ts       Cookie auth guard
vercel.json         Cron schedule
```
