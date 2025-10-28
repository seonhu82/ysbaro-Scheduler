/**
 * 월간 통계 캐싱 서비스
 *
 * 월별 근무/연차/출퇴근 통계를 캐싱
 */

import { prisma } from '@/lib/prisma'
import { getOrSet, CacheKeys, CacheTTL } from './redis-client'
import {
  batchCalculateLeaveStats,
  batchCalculateWorkStats
} from '@/lib/services/query-optimizer'

/**
 * 월간 전체 통계 (대시보드용)
 */
export interface MonthlyStats {
  totalStaff: number
  activeStaff: number
  totalLeaveApplications: number
  confirmedLeaves: number
  pendingLeaves: number
  totalNightShifts: number
  totalWeekendShifts: number
  averageWorkDays: number
  calculatedAt: string
}

/**
 * 직원별 월간 통계
 */
export interface StaffMonthlyStats {
  staffId: string
  totalWorkDays: number
  nightShifts: number
  weekendShifts: number
  offDays: number
  leavesTaken: number
  leavesConfirmed: number
  leavesPending: number
}

/**
 * 월간 전체 통계 조회 (캐싱)
 */
export async function getMonthlyStats(
  clinicId: string,
  year: number,
  month: number
): Promise<MonthlyStats> {
  const key = CacheKeys.monthlyStats(clinicId, year, month)

  return getOrSet(
    key,
    async () => {
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      // 병렬로 여러 통계 조회
      const [staffList, leaveApps, nightShiftCount, weekendShiftCount] = await Promise.all([
        // 직원 목록
        prisma.staff.findMany({
          where: { clinicId },
          select: { id: true, isActive: true, workDays: true }
        }),

        // 연차 신청 현황
        prisma.leaveApplication.groupBy({
          by: ['status'],
          where: {
            clinicId,
            date: { gte: startDate, lte: endDate }
          },
          _count: { id: true }
        }),

        // 야간 근무 횟수
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)
          FROM "StaffAssignment" sa
          JOIN "Schedule" s ON sa."scheduleId" = s.id
          WHERE s."clinicId" = ${clinicId}
            AND sa.date >= ${startDate}
            AND sa.date <= ${endDate}
            AND sa."shiftType" = 'NIGHT'
        `,

        // 주말 근무 횟수 (토요일)
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)
          FROM "StaffAssignment" sa
          JOIN "Schedule" s ON sa."scheduleId" = s.id
          WHERE s."clinicId" = ${clinicId}
            AND sa.date >= ${startDate}
            AND sa.date <= ${endDate}
            AND sa."shiftType" != 'OFF'
            AND EXTRACT(DOW FROM sa.date) = 6
        `
      ])

      const activeStaff = staffList.filter(s => s.isActive)
      const confirmedLeaves = leaveApps.find(l => l.status === 'CONFIRMED')?._count.id || 0
      const pendingLeaves = leaveApps.find(l => l.status === 'PENDING')?._count.id || 0

      return {
        totalStaff: staffList.length,
        activeStaff: activeStaff.length,
        totalLeaveApplications: leaveApps.reduce((sum, l) => sum + l._count.id, 0),
        confirmedLeaves,
        pendingLeaves,
        totalNightShifts: Number(nightShiftCount[0]?.count || 0),
        totalWeekendShifts: Number(weekendShiftCount[0]?.count || 0),
        averageWorkDays:
          activeStaff.length > 0
            ? activeStaff.reduce((sum, s) => sum + s.workDays, 0) / activeStaff.length
            : 0,
        calculatedAt: new Date().toISOString()
      }
    },
    CacheTTL.MONTHLY_STATS
  )
}

/**
 * 연차 신청 통계 조회 (캐싱)
 */
export async function getLeaveStats(clinicId: string, year: number, month: number) {
  const key = CacheKeys.leaveStats(clinicId, year, month)

  return getOrSet(
    key,
    async () => {
      const stats = await batchCalculateLeaveStats(clinicId, year, month)
      return Object.fromEntries(stats)
    },
    CacheTTL.MONTHLY_STATS
  )
}

/**
 * 근무 통계 조회 (캐싱)
 */
export async function getWorkStats(clinicId: string, year: number, month: number) {
  const key = `stats:work:${clinicId}:${year}:${month}`

  return getOrSet(
    key,
    async () => {
      const stats = await batchCalculateWorkStats(clinicId, year, month)
      return Object.fromEntries(stats)
    },
    CacheTTL.MONTHLY_STATS
  )
}

/**
 * 직원별 월간 통계 조회 (캐싱)
 */
export async function getStaffMonthlyStats(
  staffId: string,
  year: number,
  month: number
): Promise<StaffMonthlyStats> {
  const key = CacheKeys.staffStats(staffId, year, month)

  return getOrSet(
    key,
    async () => {
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      const [workStats, leaveStats] = await Promise.all([
        // 근무 통계
        prisma.staffAssignment.groupBy({
          by: ['shiftType'],
          where: {
            staffId,
            date: { gte: startDate, lte: endDate }
          },
          _count: { id: true }
        }),

        // 연차 통계
        prisma.leaveApplication.groupBy({
          by: ['status'],
          where: {
            staffId,
            date: { gte: startDate, lte: endDate }
          },
          _count: { id: true }
        })
      ])

      const totalWorkDays =
        (workStats.find(w => w.shiftType === 'DAY')?._count.id || 0) +
        (workStats.find(w => w.shiftType === 'NIGHT')?._count.id || 0)
      const nightShifts = workStats.find(w => w.shiftType === 'NIGHT')?._count.id || 0
      const offDays = workStats.find(w => w.shiftType === 'OFF')?._count.id || 0

      // 주말 근무는 별도 쿼리 필요
      const weekendShifts = await prisma.staffAssignment.count({
        where: {
          staffId,
          date: { gte: startDate, lte: endDate },
          shiftType: { not: 'OFF' }
        }
      })

      const leavesConfirmed = leaveStats.find(l => l.status === 'CONFIRMED')?._count.id || 0
      const leavesPending = leaveStats.find(l => l.status === 'PENDING')?._count.id || 0

      return {
        staffId,
        totalWorkDays,
        nightShifts,
        weekendShifts,
        offDays,
        leavesTaken: leavesConfirmed,
        leavesConfirmed,
        leavesPending
      }
    },
    CacheTTL.MONTHLY_STATS
  )
}

/**
 * 출퇴근 통계 조회 (캐싱)
 */
export async function getAttendanceStats(clinicId: string, year: number, month: number) {
  const key = CacheKeys.attendanceStats(clinicId, year, month)

  return getOrSet(
    key,
    async () => {
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      const [totalRecords, suspiciousRecords, checksByType] = await Promise.all([
        // 전체 출퇴근 기록 수
        prisma.attendanceRecord.count({
          where: {
            clinicId,
            date: { gte: startDate, lte: endDate }
          }
        }),

        // 의심스러운 기록 수
        prisma.attendanceRecord.count({
          where: {
            clinicId,
            date: { gte: startDate, lte: endDate },
            isSuspicious: true
          }
        }),

        // 출근/퇴근 타입별
        prisma.attendanceRecord.groupBy({
          by: ['checkType'],
          where: {
            clinicId,
            date: { gte: startDate, lte: endDate }
          },
          _count: { id: true }
        })
      ])

      const checkIns = checksByType.find(c => c.checkType === 'IN')?._count.id || 0
      const checkOuts = checksByType.find(c => c.checkType === 'OUT')?._count.id || 0

      return {
        totalRecords,
        checkIns,
        checkOuts,
        suspiciousRecords,
        suspiciousRate: totalRecords > 0 ? (suspiciousRecords / totalRecords) * 100 : 0,
        calculatedAt: new Date().toISOString()
      }
    },
    CacheTTL.MONTHLY_STATS
  )
}

/**
 * 캐시 예열 (Cache Warming)
 */
export async function warmStatsCache(clinicId: string, year: number, month: number) {
  console.log(`🔥 Warming stats cache for ${clinicId} ${year}-${month}`)

  try {
    await Promise.all([
      getMonthlyStats(clinicId, year, month),
      getLeaveStats(clinicId, year, month),
      getAttendanceStats(clinicId, year, month)
    ])

    console.log(`✅ Stats cache warmed successfully`)
  } catch (error) {
    console.error(`❌ Failed to warm stats cache:`, error)
  }
}
