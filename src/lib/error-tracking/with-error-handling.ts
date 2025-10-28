/**
 * API 라우트 에러 핸들링 미들웨어
 *
 * Next.js API 라우트를 래핑하여 자동 에러 추적
 */

import { NextRequest, NextResponse } from 'next/server'
import { captureAPIError, addBreadcrumb } from './sentry-utils'

type APIHandler = (req: NextRequest) => Promise<NextResponse>

/**
 * API 핸들러에 에러 핸들링 추가
 *
 * @example
 * export const GET = withErrorHandling(async (req) => {
 *   const data = await fetchData()
 *   return NextResponse.json({ data })
 * })
 */
export function withErrorHandling(handler: APIHandler, options?: { logRequest?: boolean }): APIHandler {
  return async (req: NextRequest) => {
    const startTime = Date.now()
    const method = req.method
    const path = req.nextUrl.pathname

    try {
      // 요청 로깅 (옵션)
      if (options?.logRequest) {
        addBreadcrumb('api.request', `${method} ${path}`, {
          method,
          path,
          query: Object.fromEntries(req.nextUrl.searchParams)
        })
      }

      // 핸들러 실행
      const response = await handler(req)

      // 응답 시간 추적
      const duration = Date.now() - startTime
      if (duration > 5000) {
        // 5초 이상 걸린 요청 추적
        addBreadcrumb(
          'api.slow_response',
          `Slow API response: ${method} ${path}`,
          { duration, method, path },
          'warning'
        )
      }

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      // 에러를 Sentry에 캡처
      captureAPIError(error as Error, method, path, undefined, {
        duration,
        query: Object.fromEntries(req.nextUrl.searchParams),
        headers: Object.fromEntries(req.headers.entries())
      })

      // 사용자에게 친절한 에러 메시지 반환
      console.error(`❌ API Error [${method} ${path}]:`, error)

      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message:
            process.env.NODE_ENV === 'development' ? (error as Error).message : 'An error occurred'
        },
        { status: 500 }
      )
    }
  }
}

/**
 * 특정 에러 타입에 대한 커스텀 응답
 */
export function withCustomErrorHandling(
  handler: APIHandler,
  errorHandlers?: Record<string, (error: Error) => NextResponse>
): APIHandler {
  return async (req: NextRequest) => {
    try {
      return await handler(req)
    } catch (error) {
      const err = error as Error

      // 커스텀 에러 핸들러가 있으면 사용
      if (errorHandlers && err.name in errorHandlers) {
        return errorHandlers[err.name](err)
      }

      // 기본 에러 핸들링
      captureAPIError(err, req.method, req.nextUrl.pathname)

      return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
  }
}

/**
 * 비동기 작업 에러 안전 래퍼
 *
 * Promise를 안전하게 실행하고 에러 시 Sentry에 리포트
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback?: T,
  context?: { operation: string; tags?: Record<string, string> }
): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    console.error(`❌ Error in ${context?.operation || 'async operation'}:`, error)

    if (process.env.NODE_ENV === 'production') {
      const { captureError, ErrorCategory } = await import('./sentry-utils')
      captureError(error as Error, {
        category: ErrorCategory.UNKNOWN,
        tags: context?.tags,
        extra: { operation: context?.operation }
      })
    }

    return fallback
  }
}

/**
 * 여러 API 호출을 병렬로 실행하고 에러 안전하게 처리
 *
 * @example
 * const [user, stats] = await parallelSafeAsync([
 *   () => fetchUser(id),
 *   () => fetchStats(id)
 * ])
 */
export async function parallelSafeAsync<T extends readonly unknown[] | []>(
  fns: readonly (() => Promise<T[number]>)[]
): Promise<(T[number] | undefined)[]> {
  const results = await Promise.allSettled(fns.map(fn => fn()))

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      console.error(`❌ Parallel async error at index ${index}:`, result.reason)

      if (process.env.NODE_ENV === 'production') {
        const { captureError, ErrorCategory } = require('./sentry-utils')
        captureError(result.reason, {
          category: ErrorCategory.UNKNOWN,
          extra: { parallelIndex: index }
        })
      }

      return undefined
    }
  })
}
