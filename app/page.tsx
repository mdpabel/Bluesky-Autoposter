import {
  getBookDayState,
  getHistory,
  getPostedBookIds,
  getPostedGuids,
  PostRecord,
} from '@/lib/redis';
import { fetchFeedItems, FeedItem } from '@/lib/rss';
import { TriggerButton } from '@/app/components/TriggerButton';
import { BookTriggerButton } from '@/app/components/BookTriggerButton';
import { LogoutButton } from '@/app/components/LogoutButton';
import { BOOK_CONTENT, rankBookContentCandidates } from '@/lib/book-content';
import {
  getActiveBookSlots,
  getBookPostsPerDay,
  getBookSlotLabel,
  getDhakaDateKey,
} from '@/lib/book-schedule';

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── sub-components (server) ────────────────────────────────────────────────

function BlueSkyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 360 320' className={className} aria-hidden>
      <path
        fill='currentColor'
        d='M180 141.964C163.699 110.262 119.65 46.017 74.699 22.15C44.14 6.066 11.29-.558 5.08 8.818c-6.215 9.382-.665 27.612 3.588 38.392C21.597 80.753 56.403 95.39 76.613 104.85c-25.973 3.026-82.133 10.08-75.953 31.65C4.65 150.83 22.7 162.48 84.28 180.01c-23.72 4.43-67.33 15.47-79.92 28.55C-5.26 218.7 3.95 234.47 25.43 243.26c34.12 13.92 97.64 34.76 154.57 34.76s120.45-20.84 154.57-34.76c21.48-8.79 30.69-24.56 21.07-34.7-12.59-13.08-56.2-24.12-79.92-28.55 61.58-17.53 79.63-29.18 83.62-43.51 6.18-21.57-49.98-28.624-75.95-31.65 20.21-9.46 55.016-24.097 67.945-57.64C355.588 36.43 361.138 18.2 354.924 8.818 348.71-.558 315.86 6.066 285.301 22.15 240.35 46.017 196.301 110.262 180 141.964Z'
      />
    </svg>
  );
}

function StatusPill({ status }: { status: 'posted' | 'failed' }) {
  return status === 'posted' ? (
    <span className='inline-flex items-center gap-1.5 bg-emerald-50 px-2.5 py-0.5 rounded-full ring-1 ring-emerald-200 font-medium text-emerald-700 text-xs'>
      <span className='bg-emerald-500 rounded-full w-1.5 h-1.5' />
      Posted
    </span>
  ) : (
    <span className='inline-flex items-center gap-1.5 bg-red-50 px-2.5 py-0.5 rounded-full ring-1 ring-red-200 font-medium text-red-700 text-xs'>
      <span className='bg-red-500 rounded-full w-1.5 h-1.5' />
      Failed
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className='bg-white shadow-sm px-6 py-5 border border-slate-200 rounded-2xl'>
      <p className='font-semibold text-slate-400 text-xs uppercase tracking-wider'>
        {label}
      </p>
      <p className={`text-4xl font-bold mt-2 tabular-nums ${accent}`}>
        {value}
      </p>
      {sub && <p className='mt-1 text-slate-400 text-xs'>{sub}</p>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className='flex flex-col justify-center items-center py-16 text-slate-400'>
      <svg
        className='opacity-30 mb-3 w-10 h-10'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'>
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={1.5}
          d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
        />
      </svg>
      <p className='text-sm'>{message}</p>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────

export default async function Dashboard() {
  const dateKey = getDhakaDateKey();
  const [history, rawItems, postedGuids, postedBookIds, bookDayState] = await Promise.all([
    getHistory(50).catch((): PostRecord[] => []),
    fetchFeedItems().catch((): FeedItem[] => []),
    getPostedGuids().catch((): string[] => []),
    getPostedBookIds().catch((): string[] => []),
    getBookDayState(dateKey).catch(() => ({ chapters: [], hasPromotion: false, postedCount: 0 })),
  ]);

  const postedSet = new Set(postedGuids);
  const upcoming = rawItems.filter((item) => !postedSet.has(item.guid));
  const upcomingBook = rankBookContentCandidates({
    postedIds: postedBookIds,
    excludedChapters: bookDayState.chapters,
    allowPromotional: !bookDayState.hasPromotion,
    seed: `${dateKey}:dashboard`,
  });
  const activeBookSlots = getActiveBookSlots(dateKey);
  const bookReady = BOOK_CONTENT.length - postedBookIds.length;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const totalPosted = history.filter((r) => r.status === 'posted').length;
  const thisWeek = history.filter(
    (r) => r.status === 'posted' && r.timestamp > weekAgo,
  ).length;
  const failed = history.filter((r) => r.status === 'failed').length;
  const lastRun = history[0]?.timestamp;
  const successRate =
    totalPosted + failed > 0
      ? Math.round((totalPosted / (totalPosted + failed)) * 100)
      : null;

  return (
    <div className='bg-slate-50 min-h-screen'>
      {/* ── header ── */}
      <header className='top-0 z-10 sticky bg-white backdrop-blur border-slate-200 border-b'>
        <div className='flex justify-between items-center gap-4 mx-auto px-6 py-4 max-w-6xl'>
          <div className='flex items-center gap-3 min-w-0'>
            <div className='flex justify-center items-center bg-[#0085FF] shadow-sm rounded-xl w-9 h-9 shrink-0'>
              <BlueSkyIcon className='w-5 h-5 text-white' />
            </div>
            <div className='min-w-0'>
              <h1 className='font-semibold text-slate-900 text-base leading-tight'>
                Bluesky Autoposter
              </h1>
              <p className='text-slate-400 text-xs truncate leading-tight'>
                @mdpabel.com · RSS daily · {getBookPostsPerDay()} varied book posts/day
                {lastRun && (
                  <>
                    {' · '}Last run{' '}
                    <span className='font-medium text-slate-500'>
                      {timeAgo(lastRun)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <BookTriggerButton />
            <TriggerButton />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className='space-y-6 mx-auto px-6 py-8 max-w-6xl'>
        {/* ── stats ── */}
        <div className='gap-4 grid grid-cols-2 sm:grid-cols-5'>
          <StatCard
            label='Total Posted'
            value={totalPosted}
            accent='text-[#0085FF]'
            sub='all time'
          />
          <StatCard
            label='This Week'
            value={thisWeek}
            accent='text-emerald-600'
            sub='last 7 days'
          />
          <StatCard
            label='Failed'
            value={failed}
            accent={failed > 0 ? 'text-red-500' : 'text-slate-300'}
            sub='all time'
          />
          <StatCard
            label='Success Rate'
            value={successRate !== null ? `${successRate}%` : '—'}
            accent={
              successRate !== null && successRate < 80
                ? 'text-amber-500'
                : 'text-slate-700'
            }
            sub={
              totalPosted + failed === 0
                ? 'no runs yet'
                : `${totalPosted + failed} attempts`
            }
          />
          <StatCard
            label='Book Ready'
            value={bookReady}
            accent='text-violet-600'
            sub={`${postedBookIds.length} of ${BOOK_CONTENT.length} posted`}
          />
        </div>

        {/* ── content grid ── */}
        <div className='items-start gap-6 grid grid-cols-1 lg:grid-cols-3'>
          {/* Recent Posts — 2/3 */}
          <section className='lg:col-span-2 bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden'>
            <div className='flex justify-between items-center px-6 py-4 border-slate-100 border-b'>
              <h2 className='font-semibold text-slate-800'>Recent Posts</h2>
              <span className='text-slate-400 text-xs'>
                {history.length} records
              </span>
            </div>

            {history.length === 0 ? (
              <EmptyState message='No posts yet — hit "Run Now" to publish your first article.' />
            ) : (
              <ul className='divide-y divide-slate-100'>
                {history.map((record, i) => (
                  <li
                    key={`${record.guid}-${i}`}
                    className='flex items-start gap-4 hover:bg-slate-50/70 px-6 py-4 transition-colors'>
                    <div
                      className={`mt-2 w-2 h-2 rounded-full shrink-0 ${
                        record.status === 'posted'
                          ? 'bg-emerald-400'
                          : 'bg-red-400'
                      }`}
                    />
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium text-slate-900 text-sm truncate'>
                        {record.title}
                      </p>
                      {record.error && (
                        <p className='mt-0.5 text-red-500 text-xs truncate'>
                          {record.error}
                        </p>
                      )}
                      {record.url && (
                        <a
                          href={record.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='block mt-0.5 text-slate-400 hover:text-[#0085FF] text-xs truncate transition-colors'>
                          {record.url}
                        </a>
                      )}
                    </div>
                    <div className='flex flex-col items-end gap-1.5 shrink-0'>
                      <span className='text-slate-400 text-xs whitespace-nowrap'>
                        {fmt(record.timestamp)}
                      </span>
                      <StatusPill status={record.status} />
                      {record.bskyUrl && (
                        <a
                          href={record.bskyUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center gap-0.5 text-[#0085FF] text-xs hover:underline'>
                          View post
                          <svg
                            className='w-3 h-3'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                            />
                          </svg>
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Upcoming — 1/3 */}
          <section className='bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden'>
            <div className='flex justify-between items-center px-6 py-4 border-slate-100 border-b'>
              <h2 className='font-semibold text-slate-800'>Upcoming</h2>
              <span className='inline-flex items-center bg-slate-100 px-2 py-0.5 rounded-full font-medium text-slate-600 text-xs'>
                {upcoming.length} queued
              </span>
            </div>

            {upcoming.length === 0 ? (
              <EmptyState message='All articles have been posted.' />
            ) : (
              <ul className='divide-y divide-slate-100'>
                {upcoming.slice(0, 12).map((item) => (
                  <li
                    key={item.guid}
                    className='hover:bg-slate-50/70 px-6 py-4 transition-colors'>
                    <p className='font-medium text-slate-800 text-sm line-clamp-2 leading-snug'>
                      {item.title}
                    </p>
                    <a
                      href={item.link}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center gap-0.5 mt-1 text-slate-400 hover:text-[#0085FF] text-xs transition-colors'>
                      Read article
                      <svg
                        className='w-3 h-3'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                        />
                      </svg>
                    </a>
                  </li>
                ))}
                {upcoming.length > 12 && (
                  <li className='bg-slate-50 px-6 py-3 text-slate-400 text-xs text-center'>
                    +{upcoming.length - 12} more articles queued
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>

        <section className='bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden'>
          <div className='flex flex-wrap justify-between items-center gap-3 px-6 py-4 border-slate-100 border-b'>
            <div>
              <h2 className='font-semibold text-slate-800'>Book Content Queue</h2>
              <p className='mt-1 text-slate-400 text-xs'>
                {bookReady} reviewed posts remain · today: {activeBookSlots.map(getBookSlotLabel).join(' and ')}
              </p>
            </div>
            <span className='inline-flex items-center bg-violet-50 px-2.5 py-1 rounded-full font-medium text-violet-700 text-xs'>
              {getBookPostsPerDay()} posts/day
            </span>
          </div>

          {upcomingBook.length === 0 ? (
            <EmptyState message='All 204 book insights have been posted.' />
          ) : (
            <div className='gap-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-6'>
              {upcomingBook.slice(0, 6).map((record) => (
                <article key={record.id} className='bg-slate-50 p-4 border border-slate-100 rounded-xl'>
                  <div className='flex justify-between items-center gap-2 mb-3'>
                    <span className='font-medium text-violet-700 text-xs'>
                      {record.id} · Chapter {record.chapter}
                    </span>
                    <span className='bg-white px-2 py-0.5 border border-slate-200 rounded-full text-slate-500 text-[11px]'>
                      {record.promotion}
                    </span>
                  </div>
                  <p className='text-slate-800 text-sm whitespace-pre-line leading-6'>
                    {record.post}
                  </p>
                  <p className='mt-3 text-slate-400 text-xs'>
                    {record.graphemeCount}/300 · {record.audience}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── footer ── */}
      <footer className='mx-auto px-6 py-8 max-w-6xl'>
        <p className='text-slate-400 text-xs text-center'>
          RSS runs daily at{' '}
          <span className='font-medium text-slate-500'>13:00 UTC</span>. Book
          posts use randomized Dhaka-time windows via Vercel · RSS:{' '}
          <a
            href='https://www.mdpabel.com/rss.xml'
            target='_blank'
            rel='noopener noreferrer'
            className='hover:text-[#0085FF] transition-colors'>
            mdpabel.com/rss.xml
          </a>
        </p>
      </footer>
    </div>
  );
}
