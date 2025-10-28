/**
 * 캐시 무효화 Hooks
 *
 * 데이터 변경 시 관련 캐시를 무효화하는 헬퍼 함수들
 */

import {
  invalidateFairnessCache,
  invalidateScheduleCache,
  invalidateStaffCache,
  invalidateSettingsCache
} from './redis-client'

/**
 * 연차 신청 승인/거절 시 캐시 무효화
 *
 * 사용 예:
 * ```typescript
 * await prisma.leaveApplication.update({ ... })
 * await onLeaveApplicationChange(clinicId, year, month, weekNumber)
 * ```
 */
export async function onLeaveApplicationChange(
  clinicId: string,
  year: number,
  month: number,
  weekNumber?: number
): Promise<void> {
  console.log(`🗑️  Invalidating cache after leave application change`)

  await Promise.all([
    // 형평성 관련 캐시 무효화
    invalidateFairnessCache(clinicId, year, month),

    // 스케줄 관련 캐시 무효화
    invalidateScheduleCache(clinicId, year, month, weekNumber)
  ])
}

/**
 * 스케줄 배치 완료 시 캐시 무효화
 *
 * 사용 예:
 * ```typescript
 * await runWeeklyAssignment(...)
 * await onScheduleAssignmentComplete(clinicId, year, month, weekNumber)
 * ```
 */
export async function onScheduleAssignmentComplete(
  clinicId: string,
  year: number,
  month: number,
  weekNumber: number
): Promise<void> {
  console.log(`🗑️  Invalidating cache after schedule assignment`)

  await Promise.all([
    invalidateFairnessCache(clinicId, year, month),
    invalidateScheduleCache(clinicId, year, month, weekNumber)
  ])

  // 캐시 예열 (선택적)
  // import { warmFairnessCache, warmStatsCache } from './cache'
  // await warmFairnessCache(clinicId, year, month)
  // await warmStatsCache(clinicId, year, month)
}

/**
 * 형평성 점수 업데이트 시 캐시 무효화
 *
 * 사용 예:
 * ```typescript
 * await prisma.fairnessScore.update({ ... })
 * await onFairnessScoreUpdate(clinicId, year, month)
 * ```
 */
export async function onFairnessScoreUpdate(
  clinicId: string,
  year: number,
  month: number
): Promise<void> {
  console.log(`🗑️  Invalidating cache after fairness score update`)

  await invalidateFairnessCache(clinicId, year, month)
}

/**
 * 직원 추가/수정/삭제 시 캐시 무효화
 *
 * 사용 예:
 * ```typescript
 * await prisma.staff.create({ ... })
 * await onStaffChange(clinicId)
 * ```
 */
export async function onStaffChange(clinicId: string): Promise<void> {
  console.log(`🗑️  Invalidating cache after staff change`)

  await invalidateStaffCache(clinicId)
}

/**
 * 설정 변경 시 캐시 무효화
 *
 * 사용 예:
 * ```typescript
 * await prisma.fairnessSettings.update({ ... })
 * await onSettingsChange(clinicId)
 * ```
 */
export async function onSettingsChange(clinicId: string): Promise<void> {
  console.log(`🗑️  Invalidating cache after settings change`)

  await invalidateSettingsCache(clinicId)
}

/**
 * 출퇴근 기록 추가 시 캐시 무효화 (통계만)
 *
 * 사용 예:
 * ```typescript
 * await prisma.attendanceRecord.create({ ... })
 * await onAttendanceRecordChange(clinicId, year, month)
 * ```
 */
export async function onAttendanceRecordChange(
  clinicId: string,
  year: number,
  month: number
): Promise<void> {
  console.log(`🗑️  Invalidating attendance cache`)

  // 출퇴근 통계만 무효화
  const { redis, CacheKeys } = await import('./redis-client')
  await redis.del(CacheKeys.attendanceStats(clinicId, year, month))
}

/**
 * 통합 캐시 무효화 헬퍼
 *
 * 여러 변경이 동시에 발생했을 때 사용
 */
export async function invalidateAllRelatedCache(
  clinicId: string,
  year: number,
  month: number
): Promise<void> {
  console.log(`🗑️  Invalidating all related cache for ${clinicId} ${year}-${month}`)

  await Promise.all([
    invalidateFairnessCache(clinicId, year, month),
    invalidateScheduleCache(clinicId, year, month),
    invalidateStaffCache(clinicId),
    invalidateSettingsCache(clinicId)
  ])
}
