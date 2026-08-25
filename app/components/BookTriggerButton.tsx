'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { runBookNow, RunResult } from '@/app/actions'

export function BookTriggerButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<RunResult | null>(null)

  function handleClick() {
    setResult(null)
    startTransition(async () => {
      const response = await runBookNow()
      setResult(response)
      router.refresh()
    })
  }

  return (
    <div className='flex items-center gap-3'>
      {result && !isPending && (
        <p className={`text-xs ${result.failed ? 'text-red-500' : 'text-slate-500'}`}>
          {result.posted ? 'Book insight posted' : result.failed ? 'Book post failed' : 'Nothing ready'}
        </p>
      )}
      <button
        onClick={handleClick}
        disabled={isPending}
        className='inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium text-white text-sm transition-colors'>
        {isPending ? 'Posting…' : 'Post Book Insight'}
      </button>
    </div>
  )
}
