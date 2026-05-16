'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { runNow, RunResult } from '@/app/actions'

export function TriggerButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<RunResult | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const res = await runNow()
      setResult(res)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-4">
      {result && !isPending && (
        <p className="text-sm text-slate-500">
          <span className="text-emerald-600 font-medium">{result.posted} posted</span>
          {' · '}
          <span>{result.skipped} skipped</span>
          {result.failed > 0 && (
            <>
              {' · '}
              <span className="text-red-500 font-medium">{result.failed} failed</span>
            </>
          )}
        </p>
      )}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all
          bg-[#0085FF] hover:bg-[#006FD6] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        {isPending ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Run Now
          </>
        )}
      </button>
    </div>
  )
}
