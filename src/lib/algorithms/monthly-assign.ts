// 월간 자동 배치 알고리즘 ⭐⭐⭐

import { prisma } from '@/lib/prisma'
import type { AssignmentConfig, AssignmentResult } from '@/types/schedule'
import { calculateFairnessScore, calculateTeamFairness } from './fairness-calculator'

interface StaffWithMetrics {
  id: string
  name: string
  rank: string
  categoryName: string
  workType: string
  totalAnnualDays: number
  usedAnnualDays: number
  nightShifts: number
  weekendShifts: number
  totalShifts: number
  consecutiveWorkDays: number
  lastWorkDate: Date | null
}

export async function monthlyAssign(config: AssignmentConfig): Promise<AssignmentResult> {
  const { year, month, mode, ratios } = config
  const warnings: string[] = []
  let successCount = 0
  let failedCount = 0

  try {
    // 1. 데이터 수집
    const schedules = await prisma.schedule.findMany({
      where: {
        year,
        month,
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0)
        }
      },
      include: {
        doctors: {
          include: { doctor: true }
        },
        staffAssignments: {
          include: { staff: true }
        }
      },
      orderBy: { date: 'asc' }
    })

    if (schedules.length === 0) {
      warnings.push('No schedules found for the specified month')
      return {
        success: false,
        totalSchedules: 0,
        successCount: 0,
        failedCount: 0,
        warnings,
        fairnessScore: 0
      }
    }

    // 활성 직원 조회
    const allStaff = await prisma.staff.findMany({
      where: { isActive: true }
    })

    if (allStaff.length === 0) {
      warnings.push('No active staff found')
      return {
        success: false,
        totalSchedules: schedules.length,
        successCount: 0,
        failedCount: schedules.length,
        warnings,
        fairnessScore: 0
      }
    }

    // 직원 메트릭 초기화
    const staffMetrics = new Map<string, StaffWithMetrics>()
    allStaff.forEach(staff => {
      staffMetrics.set(staff.id, {
        ...staff,
        nightShifts: 0,
        weekendShifts: 0,
        totalShifts: 0,
        consecutiveWorkDays: 0,
        lastWorkDate: null
      })
    })

    // 2. 배치 방식 결정
    if (mode === 'full') {
      // 완전 재배치: 기존 배치 삭제
      await prisma.staffAssignment.deleteMany({
        where: {
          schedule: {
            year,
            month
          }
        }
      })
    }

    // 3. 각 날짜별 직원 배치
    for (const schedule of schedules) {
      try {
        const dayOfWeek = schedule.date.getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        const hasNightShift = schedule.hasNightShift

        // 필요 인원 수 계산 (원장 1명당 2명의 스태프)
        const requiredStaffCount = schedule.doctors.length * 2

        // 직원 선발
        const selectedStaff = selectStaffForDay(
          staffMetrics,
          requiredStaffCount,
          isWeekend,
          hasNightShift,
          ratios
        )

        if (selectedStaff.length < requiredStaffCount) {
          warnings.push(
            `${schedule.date.toISOString().split('T')[0]}: Not enough staff (needed ${requiredStaffCount}, got ${selectedStaff.length})`
          )
          failedCount++
          continue
        }

        // 배치 생성 (기존 배치가 있으면 스킵, mode='full'이면 이미 삭제됨)
        if (mode === 'smart') {
          const existingAssignments = await prisma.staffAssignment.count({
            where: { scheduleId: schedule.id }
          })
          if (existingAssignments > 0) {
            successCount++
            continue
          }
        }

        // StaffAssignment 생성
        await prisma.staffAssignment.createMany({
          data: selectedStaff.map(staffId => ({
            scheduleId: schedule.id,
            staffId,
            shiftType: hasNightShift ? 'NIGHT' : 'DAY',
            status: 'CONFIRMED'
          }))
        })

        // 메트릭 업데이트
        selectedStaff.forEach(staffId => {
          const metrics = staffMetrics.get(staffId)
          if (metrics) {
            metrics.totalShifts++
            if (isWeekend) metrics.weekendShifts++
            if (hasNightShift) metrics.nightShifts++

            // 연속 근무일 계산
            if (metrics.lastWorkDate) {
              const dayDiff = Math.floor(
                (schedule.date.getTime() - metrics.lastWorkDate.getTime()) / (1000 * 60 * 60 * 24)
              )
              if (dayDiff === 1) {
                metrics.consecutiveWorkDays++
              } else {
                metrics.consecutiveWorkDays = 1
              }
            } else {
              metrics.consecutiveWorkDays = 1
            }
            metrics.lastWorkDate = schedule.date
          }
        })

        successCount++
      } catch (error) {
        console.error(`Error assigning staff for ${schedule.date}:`, error)
        failedCount++
        warnings.push(
          `${schedule.date.toISOString().split('T')[0]}: Assignment failed - ${(error as Error).message}`
        )
      }
    }

    // 5. 형평성 점수 계산
    const metricsArray = Array.from(staffMetrics.values()).map(m => ({
      nightShifts: m.nightShifts,
      weekendShifts: m.weekendShifts
    }))

    const teamFairness = calculateTeamFairness(metricsArray)

    return {
      success: failedCount === 0,
      totalSchedules: schedules.length,
      successCount,
      failedCount,
      warnings,
      fairnessScore: teamFairness.overallScore
    }
  } catch (error) {
    console.error('Monthly assign error:', error)
    return {
      success: false,
      totalSchedules: 0,
      successCount,
      failedCount,
      warnings: [...warnings, `Internal error: ${(error as Error).message}`],
      fairnessScore: 0
    }
  }
}

/**
 * 특정 날짜에 배치할 직원 선발
 */
function selectStaffForDay(
  staffMetrics: Map<string, StaffWithMetrics>,
  requiredCount: number,
  isWeekend: boolean,
  hasNightShift: boolean,
  ratios?: AssignmentConfig['ratios']
): string[] {
  const availableStaff = Array.from(staffMetrics.values()).filter(
    staff => staff.usedAnnualDays < staff.totalAnnualDays
  )

  if (availableStaff.length === 0) return []

  // 우선순위 점수 계산 (낮을수록 우선)
  const staffWithPriority = availableStaff.map(staff => {
    let priority = 0

    // 총 근무일 (적을수록 우선)
    priority += staff.totalShifts * 10

    // 야간/주말 근무 (적을수록 우선)
    if (hasNightShift) priority += staff.nightShifts * 20
    if (isWeekend) priority += staff.weekendShifts * 15

    // 연속 근무일 (많을수록 불리)
    priority += staff.consecutiveWorkDays * 30

    // 연차 사용률 (높을수록 불리)
    const annualUsageRate = staff.usedAnnualDays / staff.totalAnnualDays
    priority += annualUsageRate * 50

    return { staffId: staff.id, priority, rank: staff.rank }
  })

  // 우선순위 정렬
  staffWithPriority.sort((a, b) => a.priority - b.priority)

  // 비율 기반 선발
  const selected: string[] = []
  const rankCounts: Record<string, number> = {
    HYGIENIST: 0,
    ASSISTANT: 0,
    COORDINATOR: 0,
    NURSE: 0
  }

  // 직급별 목표 인원 계산
  const targetCounts: Record<string, number> = {
    HYGIENIST: Math.ceil(requiredCount * (ratios?.senior || 0.3)),
    ASSISTANT: Math.ceil(requiredCount * (ratios?.intermediate || 0.4)),
    COORDINATOR: Math.ceil(requiredCount * (ratios?.junior || 0.2)),
    NURSE: Math.ceil(requiredCount * (ratios?.leader || 0.1))
  }

  // 1차: 비율에 맞춰 선발
  for (const item of staffWithPriority) {
    if (selected.length >= requiredCount) break

    const currentCount = rankCounts[item.rank] || 0
    const targetCount = targetCounts[item.rank] || 0

    if (currentCount < targetCount) {
      selected.push(item.staffId)
      rankCounts[item.rank] = currentCount + 1
    }
  }

  // 2차: 부족한 인원 추가 (우선순위대로)
  for (const item of staffWithPriority) {
    if (selected.length >= requiredCount) break
    if (!selected.includes(item.staffId)) {
      selected.push(item.staffId)
    }
  }

  return selected.slice(0, requiredCount)
}
