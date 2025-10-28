/**
 * Sentry 서버 설정
 *
 * 서버에서 발생하는 에러 추적 (API 라우트, 서버 컴포넌트 등)
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN
const ENVIRONMENT = process.env.NODE_ENV

// 프로덕션 환경에서만 Sentry 활성화
if (SENTRY_DSN && ENVIRONMENT === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,

    // Release 정보
    release: process.env.RELEASE_VERSION || 'unknown',

    // 성능 모니터링 (서버는 10%만 샘플링)
    tracesSampleRate: 0.1,

    // 에러 필터링 및 민감 정보 제거
    beforeSend(event, hint) {
      const error = hint.originalException

      // 개발/테스트 환경 무시
      if (ENVIRONMENT !== 'production') {
        return null
      }

      // 특정 에러 무시
      if (error && error instanceof Error) {
        // Prisma 연결 풀 경고 (정상 동작)
        if (error.message.includes('Prisma Client') && error.message.includes('already running')) {
          return null
        }

        // 예상된 비즈니스 로직 에러 (ValidationError 등)
        if (error.name === 'ValidationError' || error.name === 'AuthenticationError') {
          return null
        }
      }

      // HTTP 요청 데이터에서 민감한 정보 제거
      if (event.request) {
        // Query parameters
        if (event.request.query_string) {
          event.request.query_string = event.request.query_string.replace(
            /token=[^&]+/g,
            'token=[REDACTED]'
          )
        }

        // Body data
        if (event.request.data) {
          const sensitiveFields = [
            'password',
            'token',
            'apiKey',
            'secret',
            'pin',
            'accessToken',
            'refreshToken',
            'sessionToken'
          ]

          const redactData = (obj: any): any => {
            if (!obj || typeof obj !== 'object') return obj

            const redacted = { ...obj }
            for (const key in redacted) {
              if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                redacted[key] = '[REDACTED]'
              } else if (typeof redacted[key] === 'object') {
                redacted[key] = redactData(redacted[key])
              }
            }
            return redacted
          }

          event.request.data = redactData(event.request.data)
        }

        // Headers
        if (event.request.headers) {
          const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']
          sensitiveHeaders.forEach(header => {
            if (event.request?.headers?.[header]) {
              event.request.headers[header] = '[REDACTED]'
            }
          })
        }
      }

      return event
    },

    // 무시할 에러
    ignoreErrors: [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'NotFoundError',
      /^AbortError/
    ],

    // 통합 설정
    integrations: [
      new Sentry.Integrations.Postgres({
        // PostgreSQL 쿼리 추적
        usePgNative: false
      }),
      new Sentry.Integrations.Http({
        // HTTP 요청 추적
        tracing: true
      })
    ]
  })

  console.log('✅ Sentry 서버 초기화 완료')
}
