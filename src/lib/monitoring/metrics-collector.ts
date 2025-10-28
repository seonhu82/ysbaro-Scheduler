/**
 * 성능 메트릭 수집 시스템
 *
 * 다양한 성능 지표를 수집하고 Redis/PostgreSQL에 저장
 */

import { redis } from '@/lib/cache/redis-client'
import { prisma } from '@/lib/db'

/**
 * 메트릭 타입
 */
export enum MetricType {
  API = 'api',
  DATABASE = 'database',
  CACHE = 'cache',
  BATCH = 'batch',
  BUSINESS = 'business'
}

/**
 * 메트릭 단위
 */
export enum MetricUnit {
  MILLISECONDS = 'ms',
  COUNT = 'count',
  PERCENTAGE = 'percentage',
  BYTES = 'bytes'
}

/**
 * 성능 메트릭
 */
export interface PerformanceMetric {
  timestamp: Date
  metricType: MetricType
  metricName: string
  value: number
  unit: MetricUnit
  tags?: Record<string, string>
}

/**
 * API 메트릭
 */
export interface APIMetric {
  method: string
  path: string
  statusCode: number
  duration: number
  timestamp: Date
  userId?: string
  clinicId?: string
}

/**
 * 데이터베이스 메트릭
 */
export interface DatabaseMetric {
  operation: string
  table: string
  duration: number
  timestamp: Date
  queryType: 'read' | 'write'
}

/**
 * 캐시 메트릭
 */
export interface CacheMetric {
  operation: 'hit' | 'miss' | 'error'
  key: string
  timestamp: Date
}

/**
 * 메트릭 키 생성
 */
const MetricKeys = {
  // 실시간 데이터 (최근 5분)
  realtime: (type: MetricType, name: string) => `metrics:realtime:${type}:${name}`,

  // 단기 데이터 (1분 집계, 24시간 보존)
  shortTerm: (type: MetricType, name: string, timestamp: string) =>
    `metrics:short:${type}:${name}:${timestamp}`,

  // 중기 데이터 (5분 집계, 7일 보존)
  mediumTerm: (type: MetricType, name: string, timestamp: string) =>
    `metrics:medium:${type}:${name}:${timestamp}`,

  // API 응답 시간 목록 (최근 100개)
  apiResponseTimes: (path: string) => `metrics:api:times:${path}`,

  // 느린 요청 목록
  slowRequests: () => `metrics:slow:requests`,

  // 에러 카운터
  errorCounter: (type: string) => `metrics:errors:${type}`
}

/**
 * 메트릭 수집 클래스
 */
class MetricsCollector {
  /**
   * API 메트릭 기록
   */
  async recordAPIMetric(metric: APIMetric): Promise<void> {
    try {
      const { method, path, statusCode, duration, timestamp, userId, clinicId } = metric

      // 1. 실시간 데이터 (최근 5분)
      const realtimeKey = MetricKeys.realtime(MetricType.API, 'requests')
      await redis.lpush(realtimeKey, JSON.stringify(metric))
      await redis.ltrim(realtimeKey, 0, 99) // 최근 100개만 유지
      await redis.expire(realtimeKey, 300) // 5분 TTL

      // 2. 응답 시간 기록
      const timesKey = MetricKeys.apiResponseTimes(path)
      await redis.lpush(timesKey, duration)
      await redis.ltrim(timesKey, 0, 99)
      await redis.expire(timesKey, 3600) // 1시간 TTL

      // 3. 느린 요청 (5초 이상)
      if (duration > 5000) {
        const slowKey = MetricKeys.slowRequests()
        await redis.zadd(slowKey, {
          score: duration,
          member: JSON.stringify({ method, path, duration, timestamp, userId })
        })
        await redis.zremrangebyrank(slowKey, 0, -51) // 상위 50개만 유지
        await redis.expire(slowKey, 86400) // 24시간 TTL
      }

      // 4. 에러 카운터 (4xx, 5xx)
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? '5xx' : '4xx'
        const errorKey = MetricKeys.errorCounter(errorType)
        await redis.incr(errorKey)
        await redis.expire(errorKey, 3600)
      }

      // 5. 1분 집계 (단기 데이터)
      const minuteTimestamp = this.getMinuteTimestamp(timestamp)
      const shortKey = MetricKeys.shortTerm(MetricType.API, 'avg_duration', minuteTimestamp)
      await redis.lpush(shortKey, duration)
      await redis.expire(shortKey, 86400) // 24시간 TTL
    } catch (error) {
      console.error('Failed to record API metric:', error)
    }
  }

  /**
   * 데이터베이스 메트릭 기록
   */
  async recordDatabaseMetric(metric: DatabaseMetric): Promise<void> {
    try {
      const { operation, table, duration, timestamp, queryType } = metric

      // 실시간 데이터
      const realtimeKey = MetricKeys.realtime(MetricType.DATABASE, 'queries')
      await redis.lpush(realtimeKey, JSON.stringify(metric))
      await redis.ltrim(realtimeKey, 0, 99)
      await redis.expire(realtimeKey, 300)

      // 느린 쿼리 (100ms 이상)
      if (duration > 100) {
        const slowKey = `metrics:slow:queries`
        await redis.zadd(slowKey, {
          score: duration,
          member: JSON.stringify({ operation, table, duration, timestamp })
        })
        await redis.zremrangebyrank(slowKey, 0, -51)
        await redis.expire(slowKey, 86400)
      }

      // 테이블별 통계
      const tableKey = `metrics:db:table:${table}`
      await redis.hincrby(tableKey, queryType, 1)
      await redis.expire(tableKey, 3600)
    } catch (error) {
      console.error('Failed to record database metric:', error)
    }
  }

  /**
   * 캐시 메트릭 기록
   */
  async recordCacheMetric(metric: CacheMetric): Promise<void> {
    try {
      const { operation, key, timestamp } = metric

      // 캐시 히트/미스 카운터
      const counterKey = `metrics:cache:${operation}`
      await redis.incr(counterKey)
      await redis.expire(counterKey, 3600)

      // 키별 통계
      const keyStatsKey = `metrics:cache:keys:${key}`
      await redis.hincrby(keyStatsKey, operation, 1)
      await redis.expire(keyStatsKey, 3600)
    } catch (error) {
      console.error('Failed to record cache metric:', error)
    }
  }

  /**
   * 배치 메트릭 기록
   */
  async recordBatchMetric(
    batchType: string,
    duration: number,
    success: boolean,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const metric = {
        batchType,
        duration,
        success,
        timestamp: new Date(),
        details
      }

      const key = MetricKeys.realtime(MetricType.BATCH, batchType)
      await redis.lpush(key, JSON.stringify(metric))
      await redis.ltrim(key, 0, 49) // 최근 50개
      await redis.expire(key, 86400)

      // 성공/실패 카운터
      const resultKey = `metrics:batch:${batchType}:${success ? 'success' : 'failure'}`
      await redis.incr(resultKey)
      await redis.expire(resultKey, 86400)
    } catch (error) {
      console.error('Failed to record batch metric:', error)
    }
  }

  /**
   * 비즈니스 메트릭 기록
   */
  async recordBusinessMetric(
    metricName: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void> {
    try {
      const key = MetricKeys.realtime(MetricType.BUSINESS, metricName)
      await redis.lpush(
        key,
        JSON.stringify({
          value,
          timestamp: new Date(),
          tags
        })
      )
      await redis.ltrim(key, 0, 99)
      await redis.expire(key, 3600)
    } catch (error) {
      console.error('Failed to record business metric:', error)
    }
  }

  /**
   * 메트릭 조회 - API 응답 시간 통계
   */
  async getAPIStats(path?: string): Promise<{
    avgDuration: number
    p95Duration: number
    p99Duration: number
    totalRequests: number
    errorRate: number
  }> {
    try {
      const key = path
        ? MetricKeys.apiResponseTimes(path)
        : MetricKeys.realtime(MetricType.API, 'requests')

      const durations = await redis.lrange(key, 0, -1)
      const times = durations.map(d => (typeof d === 'string' ? parseFloat(d) : d)).filter(Boolean)

      if (times.length === 0) {
        return { avgDuration: 0, p95Duration: 0, p99Duration: 0, totalRequests: 0, errorRate: 0 }
      }

      const sorted = times.sort((a, b) => a - b)
      const avg = times.reduce((sum, t) => sum + t, 0) / times.length
      const p95Index = Math.floor(times.length * 0.95)
      const p99Index = Math.floor(times.length * 0.99)

      // 에러율 계산
      const error4xx = (await redis.get(MetricKeys.errorCounter('4xx'))) || 0
      const error5xx = (await redis.get(MetricKeys.errorCounter('5xx'))) || 0
      const totalErrors = Number(error4xx) + Number(error5xx)
      const errorRate = times.length > 0 ? (totalErrors / times.length) * 100 : 0

      return {
        avgDuration: avg,
        p95Duration: sorted[p95Index] || 0,
        p99Duration: sorted[p99Index] || 0,
        totalRequests: times.length,
        errorRate
      }
    } catch (error) {
      console.error('Failed to get API stats:', error)
      return { avgDuration: 0, p95Duration: 0, p99Duration: 0, totalRequests: 0, errorRate: 0 }
    }
  }

  /**
   * 메트릭 조회 - 느린 요청 Top 10
   */
  async getSlowRequests(limit: number = 10): Promise<any[]> {
    try {
      const key = MetricKeys.slowRequests()
      const slowRequests = await redis.zrange(key, -limit, -1, { rev: true, withScores: true })

      return slowRequests.map((item: any) => {
        try {
          const data = typeof item === 'string' ? JSON.parse(item) : item
          return data
        } catch {
          return null
        }
      }).filter(Boolean)
    } catch (error) {
      console.error('Failed to get slow requests:', error)
      return []
    }
  }

  /**
   * 메트릭 조회 - 캐시 통계
   */
  async getCacheStats(): Promise<{
    hitRate: number
    missRate: number
    errorRate: number
    totalOperations: number
  }> {
    try {
      const hits = Number((await redis.get(MetricKeys.realtime(MetricType.CACHE, 'hit'))) || 0)
      const misses = Number((await redis.get(MetricKeys.realtime(MetricType.CACHE, 'miss'))) || 0)
      const errors = Number((await redis.get(MetricKeys.realtime(MetricType.CACHE, 'error'))) || 0)

      const total = hits + misses + errors

      return {
        hitRate: total > 0 ? (hits / total) * 100 : 0,
        missRate: total > 0 ? (misses / total) * 100 : 0,
        errorRate: total > 0 ? (errors / total) * 100 : 0,
        totalOperations: total
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return { hitRate: 0, missRate: 0, errorRate: 0, totalOperations: 0 }
    }
  }

  /**
   * 헬퍼: 분 단위 타임스탬프 생성
   */
  private getMinuteTimestamp(date: Date): string {
    const d = new Date(date)
    d.setSeconds(0, 0)
    return d.toISOString()
  }

  /**
   * 메트릭을 PostgreSQL에 장기 저장 (1시간 집계)
   */
  async persistMetrics(): Promise<void> {
    try {
      // 실제 구현: Redis의 중기 데이터를 PostgreSQL로 이동
      // 별도의 cron job 또는 scheduled task로 실행
      console.log('📊 Persisting metrics to PostgreSQL...')
    } catch (error) {
      console.error('Failed to persist metrics:', error)
    }
  }
}

// 싱글톤 인스턴스
export const metricsCollector = new MetricsCollector()

/**
 * 편의 함수
 */
export const recordAPIMetric = (metric: APIMetric) => metricsCollector.recordAPIMetric(metric)
export const recordDatabaseMetric = (metric: DatabaseMetric) =>
  metricsCollector.recordDatabaseMetric(metric)
export const recordCacheMetric = (metric: CacheMetric) => metricsCollector.recordCacheMetric(metric)
export const recordBatchMetric = (
  batchType: string,
  duration: number,
  success: boolean,
  details?: Record<string, any>
) => metricsCollector.recordBatchMetric(batchType, duration, success, details)
export const recordBusinessMetric = (
  metricName: string,
  value: number,
  tags?: Record<string, string>
) => metricsCollector.recordBusinessMetric(metricName, value, tags)
