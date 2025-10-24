import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const token = req.auth
  const path = req.nextUrl.pathname

  // 공개 페이지는 인증 불필요
  if (path.startsWith('/leave-apply/') || path.startsWith('/schedule-view/')) {
    return NextResponse.next()
  }

  // 로그인, 회원가입 페이지
  if (path === '/login' || path === '/register') {
    // 이미 로그인한 사용자가 로그인 페이지 접근 시 리다이렉트
    if (token) {
      return NextResponse.redirect(new URL('/calendar', req.url))
    }
    return NextResponse.next()
  }

  // 나머지 페이지는 인증 필요
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
