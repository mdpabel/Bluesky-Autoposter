import { getHistory, getPostedGuids, PostRecord } from '@/lib/redis'
import { fetchFeedItems, FeedItem } from '@/lib/rss'
import { TriggerButton } from '@/app/components/TriggerButton'
import { LogoutButton } from '@/app/components/LogoutButton'

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ── sub-components (server) ────────────────────────────────────────────────

function BlueSkyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 320" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M180 141.964C163.699 110.262 119.65 46.017 74.699 22.15C44.14 6.066 11.29-.558 5.08 8.818c-6.215 9.382-.665 27.612 3.588 38.392C21.597 80.753 56.403 95.39 76.613 104.85c-25.973 3.026-82.133 10.08-75.953 31.65C4.65 150.83 22.7 162.48 84.28 180.01c-23.72 4.43-67.33 15.47-79.92 28.55C-5.26 218.7 3.95 234.47 25.43 243.26c34.12 13.92 97.64 34.76 154.57 34.76s120.45-20.84 154.57-34.76c21.48-8.79 30.69-24.56 21.07-34.7-12.59-13.08-56.2-24.12-79.92-28.55 61.58-17.53 79.63-29.18 83.62-43.51 6.18-21.57-49.98-28.624-75.95-31.65 20.21-9.46 55.016-24.097 67.945-57.64C355.588 36.43 361.138 18.2 354.924 8.818 348.71-.558 315.86 6.066 285.301 22.15 240.35 46.017 196.301 110.262 180 141.964Z"
      />
    </svg>
  )
}

function StatusPill({ status }: { status: 'posted' | 'failed' }) {
  return status === 'posted' ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Posted
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Failed
    </span>
  )
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number | string
  sub?: string
  accent: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-4xl font-bold mt-2 tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────

export default async function Dashboard() {
  const [history, rawItems, postedGuids] = await Promise.all([
    getHistory(50).catch((): PostRecord[] => []),
    fetchFeedItems().catch((): FeedItem[] => []),
    getPostedGuids().catch((): string[] => []),
  ])

  const postedSet = new Set(postedGuids)
  const upcoming = rawItems.filter((item) => !postedSet.has(item.guid))

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const totalPosted = history.filter((r) => r.status === 'posted').length
  const thisWeek = history.filter((r) => r.status === 'posted' && r.timestamp > weekAgo).length
  const failed = history.filter((r) => r.status === 'failed').length
  const lastRun = history[0]?.timestamp
  const successRate =
    totalPosted + failed > 0 ? Math.round((totalPosted / (totalPosted + failed)) * 100) : null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0085FF] flex items-center justify-center shrink-0 shadow-sm">
              <BlueSkyIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 leading-tight">Bluesky Autoposter</h1>
              <p className="text-xs text-slate-400 leading-tight truncate">
                @mdpabel.com · Runs daily at 13:00 UTC
                {lastRun && (
                  <>
                    {' · '}Last run{' '}
                    <span className="text-slate-500 font-medium">{timeAgo(lastRun)}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TriggerButton />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* ── stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Posted" value={totalPosted} accent="text-[#0085FF]" sub="all time" />
          <StatCard label="This Week" value={thisWeek} accent="text-emerald-600" sub="last 7 days" />
          <StatCard
            label="Failed"
            value={failed}
            accent={failed > 0 ? 'text-red-500' : 'text-slate-300'}
            sub="all time"
          />
          <StatCard
            label="Success Rate"
            value={successRate !== null ? `${successRate}%` : '—'}
            accent={successRate !== null && successRate < 80 ? 'text-amber-500' : 'text-slate-700'}
            sub={totalPosted + failed === 0 ? 'no runs yet' : `${totalPosted + failed} attempts`}
          />
        </div>

        {/* ── content grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Recent Posts — 2/3 */}
          <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Recent Posts</h2>
              <span className="text-xs text-slate-400">{history.length} records</span>
            </div>

            {history.length === 0 ? (
              <EmptyState message='No posts yet — hit "Run Now" to publish your first article.' />
            ) : (
              <ul className="divide-y divide-slate-100">
                {history.map((record, i) => (
                  <li
                    key={`${record.guid}-${i}`}
                    className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50/70 transition-colors"
                  >
                    <div
                      className={`mt-2 w-2 h-2 rounded-full shrink-0 ${
                        record.status === 'posted' ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{record.title}</p>
                      {record.error && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{record.error}</p>
                      )}
                      <a
                        href={record.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-400 hover:text-[#0085FF] transition-colors mt-0.5 block truncate"
                      >
                        {record.url}
                      </a>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="text-xs text-slate-400 whitespace-nowrap">{fmt(record.timestamp)}</span>
                      <StatusPill status={record.status} />
                      {record.bskyUrl && (
                        <a
                          href={record.bskyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-xs text-[#0085FF] hover:underline"
                        >
                          View post
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Upcoming</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                {upcoming.length} queued
              </span>
            </div>

            {upcoming.length === 0 ? (
              <EmptyState message="All articles have been posted." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcoming.slice(0, 12).map((item) => (
                  <li key={item.guid} className="px-6 py-4 hover:bg-slate-50/70 transition-colors">
                    <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
                      {item.title}
                    </p>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-0.5 text-xs text-slate-400 hover:text-[#0085FF] transition-colors"
                    >
                      Read article
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </li>
                ))}
                {upcoming.length > 12 && (
                  <li className="px-6 py-3 text-xs text-center text-slate-400 bg-slate-50">
                    +{upcoming.length - 12} more articles queued
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>
      </main>

      {/* ── footer ── */}
      <footer className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-xs text-center text-slate-400">
          Cron runs daily at{' '}
          <span className="font-medium text-slate-500">13:00 UTC</span> via Vercel ·{' '}
          RSS:{' '}
          <a
            href="https://www.mdpabel.com/rss.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#0085FF] transition-colors"
          >
            mdpabel.com/rss.xml
          </a>
        </p>
      </footer>
    </div>
  )
}
