'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password'),
      }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('Invalid username or password.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#0085FF] flex items-center justify-center shadow-lg shadow-blue-200 mb-4">
            <BlueSkyIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Bluesky Autoposter</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to access your dashboard</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0085FF]/25 focus:border-[#0085FF] transition-all"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0085FF]/25 focus:border-[#0085FF] transition-all"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0085FF] hover:bg-[#006FD6] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-blue-200"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Personal dashboard · mdpabel.com
        </p>
      </div>
    </div>
  )
}
