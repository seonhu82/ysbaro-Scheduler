import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Security Middleware
 * - Rate limiting (간단한 메모리 기반, 프로덕션에서는 Redis 권장)
 * - CSRF protection (Origin 검증)
 * - Custom header 검증
 */

// 메모리 기반 Rate Limiting (개발/소규모용)
// 프로덕션에서는 @upstash/ratelimit + Redis 사용 권장
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// 10초마다 정리
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}, 10000)

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 10000 // 10초
  const maxRequests = 100 // 10초에 100요청 (개발 환경용)

  const record = rateLimitStore.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

// CSRF 보호: Origin 검증
function checkCsrf(request: NextRequest): boolean {
  const method = request.method

  // GET, HEAD, OPTIONS는 CSRF 위험 낮음
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true
  }

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  // 개발 환경
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  // Origin 헤더가 없으면 (일부 구형 브라우저) 통과
  if (!origin) {
    return true
  }

  // Origin이 호스트와 일치하는지 확인
  try {
    const originUrl = new URL(origin)
    if (originUrl.host !== host) {
      console.warn(`CSRF check failed: origin=${origin}, host=${host}`)
      return false
    }
  } catch (error) {
    console.error('Invalid origin URL:', error)
    return false
  }

  return true
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 정적 파일 제외
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

  // 1. Rate Limiting 체크
  const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'

  if (!checkRateLimit(ip)) {
    console.warn(`Rate limit exceeded for IP: ${ip}`)
    return NextResponse.json(
      {
        success: false,
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
      },
      { status: 429 }
    )
  }

  // 2. CSRF 보호 체크 (API 라우트만)
  if (pathname.startsWith('/api/')) {
    if (!checkCsrf(request)) {
      return NextResponse.json(
        {
          success: false,
          error: 'CSRF 검증 실패. 올바른 요청이 아닙니다.'
        },
        { status: 403 }
      )
    }
  }

  // 3. 인증 체크 (보호된 라우트)
  // 공개 경로 먼저 체크
  const publicPaths = [
    '/schedule-view',
    '/leave-apply',
    '/tablet',
    '/biometric-setup',
    '/manual-assign',
    '/attendance/qr',
    '/attendance/check',
    '/api/public',
    '/api/attendance/check',
    '/api/attendance/qr-token',
    '/api/attendance/settings',
    '/api/attendance/submit-reason',
    '/api/biometric',
  ]

  const isPublic = publicPaths.some(path => pathname.startsWith(path))

  const protectedPaths = [
    '/schedule',
    '/leave-management',
    '/attendance',
    '/statistics',
    '/settings',
    '/admin',
    '/calendar',
    '/notifications',
    '/logs',
    '/fairness',
  ]

  const isProtected = !isPublic && protectedPaths.some(path => pathname.startsWith(path))

  if (isProtected) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

    if (!token) {
      // API 요청이면 401, 페이지 요청이면 로그인 페이지로
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: '인증이 필요합니다' },
          { status: 401 }
        )
      }

      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // AccountStatus 확인 (APPROVED만 허용)
    if (token.accountStatus !== 'APPROVED') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: '승인 대기 중입니다' },
          { status: 403 }
        )
      }

      return NextResponse.redirect(new URL('/pending-approval', request.url))
    }

    // 초기 설정 완료 확인 (setup/initial 페이지는 제외)
    // SUPER_ADMIN은 초기 설정 건너뛰기
    if (!pathname.startsWith('/setup/initial') && !pathname.startsWith('/api/setup/initial')) {
      if (token.setupCompleted === false && token.role !== 'SUPER_ADMIN') {
        // API 요청이면 에러 반환
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { success: false, error: '초기 설정이 필요합니다' },
            { status: 403 }
          )
        }

        // 페이지 요청이면 초기 설정으로 리다이렉트
        return NextResponse.redirect(new URL('/setup/initial', request.url))
      }
    }
  }

  // 4. 보안 헤더 추가
  const response = NextResponse.next()

  // XSS 보호
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // CSP (Content Security Policy) - 필요시 활성화
  // response.headers.set(
  //   'Content-Security-Policy',
  //   "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  // )

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
