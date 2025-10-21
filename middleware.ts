import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // 이미 로그인한 사용자가 로그인 페이지 접근 시 리다이렉트
    if (path === '/login' && token) {
      return NextResponse.redirect(new URL('/calendar', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname

        // 공개 페이지는 인증 불필요
        if (path.startsWith('/leave-apply/') || path.startsWith('/schedule-view/')) {
          return true
        }

        // 로그인 페이지는 인증 불필요
        if (path === '/login') {
          return true
        }

        // 나머지 페이지는 토큰 필요
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
