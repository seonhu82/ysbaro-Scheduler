/**
 * Sentry 클라이언트 설정
 *
 * 브라우저에서 발생하는 에러 추적
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const ENVIRONMENT = process.env.NODE_ENV

// 프로덕션 환경에서만 Sentry 활성화
if (SENTRY_DSN && ENVIRONMENT === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,

    // Release 정보
    release: process.env.NEXT_PUBLIC_RELEASE_VERSION || 'unknown',

    // 성능 모니터링 (100% 추적)
    tracesSampleRate: 1.0,

    // Session Replay (사용자 세션 녹화)
    replaysSessionSampleRate: 0.1, // 10%의 정상 세션
    replaysOnErrorSampleRate: 1.0, // 에러 발생 시 100%

    // 특정 도메인만 추적
    tracePropagationTargets: ['localhost', /^https:\/\/[^/]+\.vercel\.app/],

    // 에러 필터링
    beforeSend(event, hint) {
      const error = hint.originalException

      // 개발 환경 에러 무시
      if (ENVIRONMENT !== 'production') {
        return null
      }

      // 특정 에러 타입 무시
      if (error && error instanceof Error) {
        // React Hydration 에러 (일반적으로 무해함)
        if (
          error.message.includes('Hydration') ||
          error.message.includes('ResizeObserver loop')
        ) {
          return null
        }

        // 네트워크 에러 (사용자 인터넷 문제)
        if (error.message.includes('Failed to fetch') || error.message.includes('Network Error')) {
          return null
        }
      }

      // 민감한 정보 제거
      if (event.request?.data && typeof event.request.data === 'object') {
        const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'pin']
        const requestData = event.request.data as Record<string, any>
        sensitiveFields.forEach(field => {
          if (field in requestData) {
            requestData[field] = '[REDACTED]'
          }
        })
      }

      return event
    },

    // 무시할 에러 패턴
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection',
      /Loading chunk [\d]+ failed/, // Webpack chunk 로딩 실패 (배포 중 발생 가능)
      'ChunkLoadError',
      'NotFoundError'
    ],

    // 통합 설정
    integrations: [
      Sentry.replayIntegration({
        // 마스킹 설정
        maskAllText: true,
        blockAllMedia: true
      })
    ]
  })

  console.log('✅ Sentry 클라이언트 초기화 완료')
}
