/**
 * Redis 클라이언트 설정 및 유틸리티
 *
 * Upstash Redis를 사용하여 서버리스 환경에서 캐싱
 */

import { Redis } from '@upstash/redis'

// Upstash Redis 클라이언트 (이미 rate limiting에서 사용 중)
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

/**
 * 캐시 키 생성 헬퍼
 */
export const CacheKeys = {
  // 형평성 통계
  fairnessStats: (clinicId: string, year: number, month: number) =>
    `fairness:stats:${clinicId}:${year}:${month}`,
  fairnessCategory: (clinicId: string, year: number, month: number) =>
    `fairness:category:${clinicId}:${year}:${month}`,
  fairnessDepartment: (clinicId: string, year: number, month: number) =>
    `fairness:department:${clinicId}:${year}:${month}`,
  fairnessStaff: (staffId: string, year: number, month: number) =>
    `fairness:staff:${staffId}:${year}:${month}`,
  fairnessTrends: (staffId: string, year: number, startMonth: number, endMonth: number) =>
    `fairness:trends:${staffId}:${year}:${startMonth}:${endMonth}`,

  // 월간 통계
  monthlyStats: (clinicId: string, year: number, month: number) =>
    `stats:monthly:${clinicId}:${year}:${month}`,
  staffStats: (staffId: string, year: number, month: number) =>
    `stats:staff:${staffId}:${year}:${month}`,
  leaveStats: (clinicId: string, year: number, month: number) =>
    `stats:leave:${clinicId}:${year}:${month}`,
  attendanceStats: (clinicId: string, year: number, month: number) =>
    `stats:attendance:${clinicId}:${year}:${month}`,

  // 직원 목록
  staffList: (clinicId: string) => `staff:list:${clinicId}`,
  staffActive: (clinicId: string) => `staff:active:${clinicId}`,
  staffByCategory: (clinicId: string, category: string) =>
    `staff:by-category:${clinicId}:${category}`,
  staffByDepartment: (clinicId: string, department: string) =>
    `staff:by-department:${clinicId}:${department}`,

  // 주간 슬롯
  weekInfo: (clinicId: string, year: number, month: number, weekNumber: number) =>
    `week:info:${clinicId}:${year}:${month}:${weekNumber}`,
  weekSlots: (clinicId: string, year: number, month: number, weekNumber: number) =>
    `week:slots:${clinicId}:${year}:${month}:${weekNumber}`,
  dailySlot: (clinicId: string, date: string) => `daily:slot:${clinicId}:${date}`,

  // 공휴일
  holidays: (clinicId: string, year: number) => `holidays:${clinicId}:${year}`,
  holidaysMonth: (clinicId: string, year: number, month: number) =>
    `holidays:${clinicId}:${year}:${month}`,

  // 설정
  fairnessSettings: (clinicId: string) => `settings:fairness:${clinicId}`,
  ruleSettings: (clinicId: string) => `settings:rules:${clinicId}`,
  notificationSettings: (clinicId: string) => `settings:notification:${clinicId}`
}

/**
 * TTL (Time To Live) 상수 (초 단위)
 */
export const CacheTTL = {
  FAIRNESS: 24 * 60 * 60, // 24시간
  MONTHLY_STATS: 12 * 60 * 60, // 12시간
  STAFF_LIST: 30 * 60, // 30분
  WEEK_INFO: 60 * 60, // 1시간
  DAILY_SLOT: 30 * 60, // 30분
  HOLIDAYS: 7 * 24 * 60 * 60, // 7일
  SETTINGS: 60 * 60 // 1시간
}

/**
 * 캐시 통계 (메모리 기반)
 */
class CacheStats {
  private hits = 0
  private misses = 0
  private errors = 0

  recordHit() {
    this.hits++
  }

  recordMiss() {
    this.misses++
  }

  recordError() {
    this.errors++
  }

  getStats() {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      errors: this.errors,
      total,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0
    }
  }

  reset() {
    this.hits = 0
    this.misses = 0
    this.errors = 0
  }
}

export const cacheStats = new CacheStats()

/**
 * 캐시에서 데이터 가져오기 (없으면 fetchFn 실행하여 저장)
 */
export async function getOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CacheTTL.MONTHLY_STATS
): Promise<T> {
  try {
    // 1. 캐시 조회
    const cached = await redis.get<string>(key)

    if (cached !== null) {
      cacheStats.recordHit()
      try {
        return JSON.parse(cached) as T
      } catch (parseError) {
        console.error(`Cache parse error for key ${key}:`, parseError)
        // 손상된 캐시 삭제
        await redis.del(key)
      }
    }

    // 2. 캐시 미스 - 데이터 가져오기
    cacheStats.recordMiss()
    const data = await fetchFn()

    // 3. 캐시에 저장
    await redis.setex(key, ttl, JSON.stringify(data))

    return data
  } catch (error) {
    cacheStats.recordError()
    console.error(`Cache error for key ${key}:`, error)
    // 에러 발생 시 원본 데이터 반환
    return fetchFn()
  }
}

/**
 * 여러 키를 한번에 무효화
 */
export async function invalidateCache(keys: string[]): Promise<void> {
  if (keys.length === 0) return

  try {
    await redis.del(...keys)
    console.log(`🗑️  Invalidated ${keys.length} cache keys`)
  } catch (error) {
    console.error('Cache invalidation error:', error)
  }
}

/**
 * 패턴으로 캐시 무효화
 *
 * 주의: KEYS 명령은 프로덕션에서 주의해서 사용해야 함 (blocking)
 * 대안: SCAN 사용 (Upstash는 KEYS를 제공하지 않을 수 있음)
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    // Upstash는 KEYS 명령을 지원하지 않으므로 수동으로 키 목록 관리 필요
    // 또는 특정 키만 직접 삭제
    console.log(`⚠️  Pattern-based invalidation not fully supported: ${pattern}`)
    console.log('   Invalidate specific keys instead.')
  } catch (error) {
    console.error('Pattern cache invalidation error:', error)
  }
}

/**
 * 형평성 관련 캐시 무효화
 */
export async function invalidateFairnessCache(
  clinicId: string,
  year: number,
  month: number
): Promise<void> {
  const keys = [
    CacheKeys.fairnessStats(clinicId, year, month),
    CacheKeys.fairnessCategory(clinicId, year, month),
    CacheKeys.fairnessDepartment(clinicId, year, month),
    CacheKeys.monthlyStats(clinicId, year, month)
  ]

  await invalidateCache(keys)
}

/**
 * 연차/스케줄 관련 캐시 무효화
 */
export async function invalidateScheduleCache(
  clinicId: string,
  year: number,
  month: number,
  weekNumber?: number
): Promise<void> {
  const keys = [
    CacheKeys.monthlyStats(clinicId, year, month),
    CacheKeys.leaveStats(clinicId, year, month)
  ]

  if (weekNumber !== undefined) {
    keys.push(
      CacheKeys.weekInfo(clinicId, year, month, weekNumber),
      CacheKeys.weekSlots(clinicId, year, month, weekNumber)
    )
  }

  await invalidateCache(keys)
}

/**
 * 직원 관련 캐시 무효화
 */
export async function invalidateStaffCache(clinicId: string): Promise<void> {
  const keys = [
    CacheKeys.staffList(clinicId),
    CacheKeys.staffActive(clinicId)
    // 카테고리/부서별은 특정하기 어려우므로 생략
  ]

  await invalidateCache(keys)
}

/**
 * 설정 관련 캐시 무효화
 */
export async function invalidateSettingsCache(clinicId: string): Promise<void> {
  const keys = [
    CacheKeys.fairnessSettings(clinicId),
    CacheKeys.ruleSettings(clinicId),
    CacheKeys.notificationSettings(clinicId)
  ]

  await invalidateCache(keys)
}

/**
 * Stale-While-Revalidate 패턴
 *
 * 만료 임박 시 백그라운드에서 갱신하면서 기존 캐시 반환
 */
export async function getWithSWR<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CacheTTL.MONTHLY_STATS,
  revalidateThreshold: number = 0.1 // TTL의 10% 남았을 때 갱신
): Promise<T> {
  try {
    const cached = await redis.get<string>(key)
    const remainingTTL = await redis.ttl(key)

    // 캐시가 충분히 신선함
    if (cached !== null && remainingTTL > ttl * revalidateThreshold) {
      cacheStats.recordHit()
      return JSON.parse(cached) as T
    }

    // 캐시가 곧 만료됨 - 백그라운드 갱신
    if (cached !== null) {
      cacheStats.recordHit()
      // 비동기로 갱신 (await 하지 않음)
      fetchFn()
        .then(data => redis.setex(key, ttl, JSON.stringify(data)))
        .catch(error => console.error('Background revalidation failed:', error))

      return JSON.parse(cached) as T
    }

    // 캐시 미스 - 즉시 가져오기
    cacheStats.recordMiss()
    const data = await fetchFn()
    await redis.setex(key, ttl, JSON.stringify(data))
    return data
  } catch (error) {
    cacheStats.recordError()
    console.error(`SWR cache error for key ${key}:`, error)
    return fetchFn()
  }
}

/**
 * 캐시 워밍 - 자주 사용되는 데이터 미리 캐싱
 */
export async function warmCache(clinicId: string, year: number, month: number): Promise<void> {
  console.log(`🔥 Warming cache for clinic ${clinicId}, ${year}-${month}`)

  // 형평성 통계, 월간 통계 등을 미리 계산하여 캐싱
  // 실제 구현은 각 서비스 함수에서 수행
}

/**
 * 캐시 통계 조회
 */
export function getCacheStats() {
  return cacheStats.getStats()
}

/**
 * 캐시 통계 리셋
 */
export function resetCacheStats() {
  cacheStats.reset()
}
