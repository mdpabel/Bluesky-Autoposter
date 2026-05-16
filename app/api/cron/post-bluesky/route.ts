import { NextRequest, NextResponse } from 'next/server';
import { fetchFeedItems } from '@/lib/rss';
import { generateBlueskyPost } from '@/lib/openai';
import { postToBluesky } from '@/lib/bluesky';
import { hasBeenPosted, markAsPosted, recordPost } from '@/lib/redis';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Result = {
  guid: string;
  status: 'posted' | 'skipped' | 'failed';
  detail?: string;
};

export async function GET(req: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const auth = req.headers.get('authorization');
  if (!isDev && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Result[] = [];
  const now = Date.now();

  let items;
  try {
    items = await fetchFeedItems();
    console.log(`[cron] Fetched ${items.length} feed items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron] Failed to fetch RSS: ${msg}`);
    return NextResponse.json(
      { error: `RSS fetch failed: ${msg}` },
      { status: 500 },
    );
  }

  for (const item of items) {
    const already = await hasBeenPosted(item.guid);
    if (already) {
      console.log(`[cron] Skipped (already posted): ${item.guid}`);
      results.push({ guid: item.guid, status: 'skipped' });
      continue;
    }

    try {
      const postText = await generateBlueskyPost(
        item.title,
        item.contentSnippet,
        item.link,
      );
      const { uri, bskyUrl } = await postToBluesky(postText, item.link);
      await markAsPosted(item.guid);
      await recordPost({
        guid: item.guid,
        title: item.title,
        url: item.link,
        bskyUrl,
        status: 'posted',
        timestamp: now,
      });
      console.log(`[cron] Posted: ${item.guid} → ${uri}`);
      results.push({ guid: item.guid, status: 'posted', detail: bskyUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron] Failed to post ${item.guid}: ${msg}`);
      await recordPost({
        guid: item.guid,
        title: item.title,
        url: item.link,
        status: 'failed',
        timestamp: now,
        error: msg,
      });
      results.push({ guid: item.guid, status: 'failed', detail: msg });
    }
    break;
  }

  const summary = {
    posted: results.filter((r) => r.status === 'posted').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };
  console.log(
    `[cron] Done — posted:${summary.posted} skipped:${summary.skipped} failed:${summary.failed}`,
  );

  return NextResponse.json({ summary, results });
}
