import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, getAuthToken } from '@/lib/auth'

const PUBLIC_PREFIXES = ['/login', '/api/auth/', '/api/cron/']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const expected = await getAuthToken()
  if (token !== expected) {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete(COOKIE_NAME)
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
}
