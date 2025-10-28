/**
 * 성능 추적 미들웨어
 *
 * API 요청의 성능을 자동으로 추적하고 기록
 */

import { NextRequest, NextResponse } from 'next/server'
import { recordAPIMetric } from './metrics-collector'
import { capturePerformanceIssue } from '@/lib/error-tracking/sentry-utils'

/**
 * 성능 추적 미들웨어
 *
 * API 핸들러를 래핑하여 자동으로 성능 메트릭 수집
 */
export function withPerformanceTracking(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options?: {
    slowThreshold?: number // 느린 요청 임계값 (ms)
    trackEnabled?: boolean // 추적 활성화 여부
  }
) {
  const { slowThreshold = 5000, trackEnabled = true } = options || {}

  return async (req: NextRequest): Promise<NextResponse> => {
    if (!trackEnabled || process.env.NODE_ENV !== 'production') {
      return handler(req)
    }

    const startTime = Date.now()
    const method = req.method
    const path = req.nextUrl.pathname

    try {
      // 핸들러 실행
      const response = await handler(req)

      // 응답 시간 계산
      const duration = Date.now() - startTime
      const statusCode = response.status

      // 메트릭 기록
      await recordAPIMetric({
        method,
        path,
        statusCode,
        duration,
        timestamp: new Date()
      })

      // 느린 요청 경고
      if (duration > slowThreshold) {
        capturePerformanceIssue(
          `${method} ${path}`,
          duration,
          slowThreshold,
          {
            statusCode,
            query: Object.fromEntries(req.nextUrl.searchParams)
          }
        )
      }

      return response
    } catch (error) {
      // 에러 발생 시에도 메트릭 기록
      const duration = Date.now() - startTime

      await recordAPIMetric({
        method,
        path,
        statusCode: 500,
        duration,
        timestamp: new Date()
      })

      throw error
    }
  }
}

/**
 * 성능 측정 래퍼
 *
 * 임의의 함수의 실행 시간을 측정
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    threshold?: number
    logSlow?: boolean
  }
): Promise<T> {
  const { threshold = 1000, logSlow = true } = options || {}

  const startTime = Date.now()

  try {
    const result = await fn()
    const duration = Date.now() - startTime

    if (logSlow && duration > threshold) {
      console.warn(`⚠️ Slow operation: ${name} took ${duration}ms (threshold: ${threshold}ms)`)

      if (process.env.NODE_ENV === 'production') {
        capturePerformanceIssue(name, duration, threshold)
      }
    }

    return result
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ Failed operation: ${name} (took ${duration}ms)`, error)
    throw error
  }
}

/**
 * 데이터베이스 쿼리 성능 추적
 */
export function trackDatabaseQuery<T>(
  operation: string,
  table: string,
  queryType: 'read' | 'write'
) {
  return async (fn: () => Promise<T>): Promise<T> => {
    const startTime = Date.now()

    try {
      const result = await fn()
      const duration = Date.now() - startTime

      // 느린 쿼리 경고 (100ms 이상)
      if (duration > 100) {
        console.warn(`⚠️ Slow query: ${operation} on ${table} took ${duration}ms`)

        if (process.env.NODE_ENV === 'production') {
          const { recordDatabaseMetric } = await import('./metrics-collector')
          await recordDatabaseMetric({
            operation,
            table,
            duration,
            timestamp: new Date(),
            queryType
          })
        }
      }

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`❌ Query failed: ${operation} on ${table} (took ${duration}ms)`, error)
      throw error
    }
  }
}

/**
 * 배치 작업 성능 추적
 */
export async function trackBatchOperation<T>(
  batchType: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()

  try {
    const result = await fn()
    const duration = Date.now() - startTime

    console.log(`✅ Batch ${batchType} completed in ${duration}ms`)

    if (process.env.NODE_ENV === 'production') {
      const { recordBatchMetric } = await import('./metrics-collector')
      await recordBatchMetric(batchType, duration, true)
    }

    return result
  } catch (error) {
    const duration = Date.now() - startTime

    console.error(`❌ Batch ${batchType} failed after ${duration}ms:`, error)

    if (process.env.NODE_ENV === 'production') {
      const { recordBatchMetric } = await import('./metrics-collector')
      await recordBatchMetric(batchType, duration, false, {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    throw error
  }
}

/**
 * 리소스 사용량 모니터링
 */
export function getResourceUsage() {
  if (typeof process === 'undefined') {
    return null
  }

  const memoryUsage = process.memoryUsage()

  return {
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      rss: Math.round(memoryUsage.rss / 1024 / 1024) // MB
    },
    uptime: Math.round(process.uptime()), // seconds
    pid: process.pid
  }
}

/**
 * 시스템 상태 체크
 */
export async function getSystemHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, boolean>
  timestamp: Date
}> {
  const checks: Record<string, boolean> = {}

  // 데이터베이스 연결 체크
  try {
    const { prisma } = await import('@/lib/db')
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch {
    checks.database = false
  }

  // Redis 연결 체크
  try {
    const { redis } = await import('@/lib/cache/redis-client')
    await redis.ping()
    checks.redis = true
  } catch {
    checks.redis = false
  }

  // 전체 상태 판정
  const allHealthy = Object.values(checks).every(check => check)
  const someHealthy = Object.values(checks).some(check => check)

  const status = allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy'

  return {
    status,
    checks,
    timestamp: new Date()
  }
}
