import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// 역할별 접근 가능한 경로 정의
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    '/admin', // 슈퍼 관리자 전용 페이지
    '/calendar',
    '/schedule',
    '/leave-management',
    '/attendance',
    '/statistics',
    '/notifications',
    '/logs',
    '/settings',
    '/setup'
  ],
  ADMIN: [
    '/calendar',
    '/schedule',
    '/leave-management',
    '/attendance',
    '/statistics',
    '/notifications',
    '/logs',
    '/settings',
    '/setup'
  ],
  MANAGER: [
    '/calendar',
    '/schedule',
    '/leave-management',
    '/attendance',
    '/statistics',
    '/notifications',
    '/settings'
  ],
  STAFF: [
    '/calendar',
    '/notifications'
  ]
}

export default auth((req) => {
  const token = req.auth
  const path = req.nextUrl.pathname

  // 공개 페이지는 인증 불필요
  if (path.startsWith('/leave-apply/') ||
      path.startsWith('/schedule-view/') ||
      path.startsWith('/attendance/') && path.includes('/public')) {
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

  // 역할 기반 접근 제어
  const userRole = (token as any)?.role || 'STAFF'
  const allowedPaths = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || []

  // 현재 경로가 허용된 경로인지 확인
  const hasAccess = allowedPaths.some(allowedPath => path.startsWith(allowedPath))

  if (!hasAccess) {
    // 접근 권한 없음 - 기본 페이지로 리다이렉트
    return NextResponse.redirect(new URL('/calendar', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
