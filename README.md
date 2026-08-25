# Bluesky Autoposter

Personal dashboard that publishes new [mdpabel.com](https://mdpabel.com) articles and a reviewed local library of WordPress malware-recovery insights to Bluesky.

## Publishing streams

The app has two independent publishing streams:

1. The RSS cron runs daily at **13:00 UTC**, finds the next unposted article, generates an issue-led caption, attaches its featured-image card, and records the result.
2. The book scheduler has six possible windows between **09:00 and 21:59 Asia/Dhaka**. A deterministic daily shuffle activates two windows by default, or three when configured.
3. Book selection prefers a different chapter for each post that day and allows no more than one soft/direct promotion per Dhaka day.
4. Pure-value records are plain text. The 13 soft and four direct promotional records attach the book link card.
5. Redis prevents duplicate content and duplicate processing of the same daily window.

The app ships with 204 reviewed records in `data/book-content/catalog.json`. Scheduled book posts do not call OpenAI or generate new copy.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| Hosting + cron | Vercel |
| Persistence | Upstash Redis |
| RSS caption generation | OpenAI GPT-5.6 Terra (configurable) |
| Bluesky API | `@atproto/api` |
| Book content | Local reviewed JSON catalog (204 records) |

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
| `BOOK_POSTS_PER_DAY` | `2` by default; set to `3` for three book posts per Dhaka day |
| `BOOK_SCHEDULE_SEED` | Private random string used to vary daily windows and content order |
| `BOOK_PROMOTION_URL` | Landing page attached to soft and direct book promotions |
| `BASIC_AUTH_USER` | Dashboard login username |
| `BASIC_AUTH_PASSWORD` | Dashboard login password |

Add the variables in Vercel under **Settings → Environment Variables** before deploying.

## Dashboard

The dashboard shows combined post history, upcoming RSS articles, the remaining book-content count, today's selected windows, and six upcoming book records.

- **Run Now** publishes the next RSS article.
- **Post Book Insight** immediately publishes one reviewed book record.

Manual book posts still use Redis deduplication and the one-promotional-record-per-day rule.

## Cron configuration

`vercel.json` contains all required jobs. Redeploying registers them; no manual cron entry is required.

```text
RSS:          13:00 UTC daily
Book windows: 03:00, 05:00, 07:00, 09:00, 11:00, 15:00 UTC daily
              09:00, 11:00, 13:00, 15:00, 17:00, 21:00 Asia/Dhaka
```

Only two or three book windows activate on a given day. The others return a successful skip response. The selected windows change each day but remain spaced across the day.

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to cron routes. Cron endpoints also work without that header in `NODE_ENV=development`.

## Project structure

```text
app/
  api/
    auth/login/                       POST - sets auth cookie
    auth/logout/                      POST - clears auth cookie
    cron/post-bluesky/                GET - RSS cron
    cron/post-book-content/[slot]/    GET - randomized book-content windows
  components/
    TriggerButton                     manual RSS post
    BookTriggerButton                 manual book post
  page.tsx                            dashboard
data/book-content/
  catalog.json                        reviewed 204-record database
  manifest.json                       source and count metadata
lib/
  bluesky.ts                          link-card and plain-text publishing
  book-content.ts                     typed catalog and selector
  book-publisher.ts                   book publishing workflow
  book-schedule.ts                    Dhaka daily-window selection
  openai.ts                           RSS caption generation
  redis.ts                            history, locks, and deduplication
  rss.ts                              RSS feed fetching
middleware.ts                         dashboard auth guard
vercel.json                           cron schedules
```
