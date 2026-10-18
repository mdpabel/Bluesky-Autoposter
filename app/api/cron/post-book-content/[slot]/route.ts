import { NextResponse } from 'next/server'

// Keep the former cron URL inert if an old scheduler still calls it.
export async function GET() {
  return NextResponse.json(
    { status: 'disabled', reason: 'book-posting-stopped' },
    { status: 410 },
  )
}
