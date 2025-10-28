/**
 * 연속 근무 제한 서비스
 *
 * 직원의 연속 근무일을 추적하고 제한하여 과로 방지
 *
 * 규칙:
 * - 최대 연속 근무일: 6일 (설정 가능)
 * - 연속 근무일 초과 시 경고 또는 자동 오프 배정
 * - 연차 사용 시 연속 근무일 리셋
 */

import { prisma } from '@/lib/prisma'
import { addDays, subDays, isSameDay } from 'date-fns'

export interface ConsecutiveWorkInfo {
  staffId: string
  staffName: string
  consecutiveDays: number
  startDate: Date
  endDate: Date
  isOverLimit: boolean
  remainingDays: number
}

export interface ConsecutiveWorkValidation {
  isValid: boolean
  consecutiveDays: number
  maxConsecutiveDays: number
  warning?: string
  error?: string
}

/**
 * 특정 직원의 연속 근무일 계산
 */
export async function calculateConsecutiveWorkDays(
  staffId: string,
  targetDate: Date
): Promise<number> {
  // 과거로 거슬러 올라가며 연속 근무일 계산
  let consecutiveDays = 0
  let currentDate = subDays(targetDate, 1) // 전날부터 시작

  while (true) {
    const assignment = await prisma.staffAssignment.findFirst({
      where: {
        staffId,
        date: currentDate,
        shiftType: { not: 'OFF' } // OFF가 아닌 모든 근무
      }
    })

    // 연차 확인
    const leaveApplication = await prisma.leaveApplication.findFirst({
      where: {
        staffId,
        date: currentDate,
        status: { in: ['CONFIRMED', 'PENDING'] }
      }
    })

    // 근무가 아니거나 연차인 경우 중단
    if (!assignment || leaveApplication) {
      break
    }

    consecutiveDays++
    currentDate = subDays(currentDate, 1)

    // 무한 루프 방지 (최대 30일)
    if (consecutiveDays >= 30) {
      break
    }
  }

  return consecutiveDays
}

/**
 * 특정 직원의 미래 연속 근무일 예측
 */
export async function predictConsecutiveWorkDays(
  staffId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  let consecutiveDays = await calculateConsecutiveWorkDays(staffId, startDate)
  let currentDate = startDate

  while (currentDate <= endDate) {
    const assignment = await prisma.staffAssignment.findFirst({
      where: {
        staffId,
        date: currentDate,
        shiftType: { not: 'OFF' }
      }
    })

    const leaveApplication = await prisma.leaveApplication.findFirst({
      where: {
        staffId,
        date: currentDate,
        status: { in: ['CONFIRMED', 'PENDING'] }
      }
    })

    if (assignment && !leaveApplication) {
      consecutiveDays++
    } else {
      // 쉬는 날이면 리셋
      consecutiveDays = 0
    }

    currentDate = addDays(currentDate, 1)
  }

  return consecutiveDays
}

/**
 * 연속 근무일 검증 (연차 신청 시)
 */
export async function validateConsecutiveWork(
  staffId: string,
  leaveDate: Date,
  maxConsecutiveDays: number = 6
): Promise<ConsecutiveWorkValidation> {
  // 현재까지의 연속 근무일
  const currentConsecutiveDays = await calculateConsecutiveWorkDays(staffId, leaveDate)

  // 연차를 사용하지 않았을 경우의 연속 근무일
  const wouldBeConsecutiveDays = currentConsecutiveDays + 1

  // 검증
  if (wouldBeConsecutiveDays > maxConsecutiveDays) {
    return {
      isValid: false,
      consecutiveDays: currentConsecutiveDays,
      maxConsecutiveDays,
      error: `연차 사용을 권장합니다. 현재 ${currentConsecutiveDays}일 연속 근무 중입니다 (최대 ${maxConsecutiveDays}일).`
    }
  }

  if (wouldBeConsecutiveDays === maxConsecutiveDays) {
    return {
      isValid: true,
      consecutiveDays: currentConsecutiveDays,
      maxConsecutiveDays,
      warning: `${wouldBeConsecutiveDays}일 연속 근무가 됩니다. 휴식을 권장합니다.`
    }
  }

  return {
    isValid: true,
    consecutiveDays: currentConsecutiveDays,
    maxConsecutiveDays
  }
}

/**
 * 주간 배치 시 연속 근무일 체크
 */
export async function checkConsecutiveWorkInWeek(
  clinicId: string,
  weekStart: Date,
  weekEnd: Date,
  maxConsecutiveDays: number = 6
): Promise<ConsecutiveWorkInfo[]> {
  console.log(`\n🔍 연속 근무일 체크: ${weekStart.toISOString().split('T')[0]} ~ ${weekEnd.toISOString().split('T')[0]}`)

  // 모든 직원 조회
  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: {
      id: true,
      name: true
    }
  })

  const warnings: ConsecutiveWorkInfo[] = []

  for (const staff of staffList) {
    // 주 마지막 날까지의 연속 근무일 예측
    const consecutiveDays = await predictConsecutiveWorkDays(
      staff.id,
      weekStart,
      weekEnd
    )

    if (consecutiveDays > maxConsecutiveDays) {
      // 연속 근무일 시작일 계산
      const startDate = subDays(weekEnd, consecutiveDays - 1)

      warnings.push({
        staffId: staff.id,
        staffName: staff.name || '직원',
        consecutiveDays,
        startDate,
        endDate: weekEnd,
        isOverLimit: true,
        remainingDays: 0
      })

      console.log(`   ⚠️  ${staff.name}: ${consecutiveDays}일 연속 근무 (한계: ${maxConsecutiveDays}일)`)
    } else if (consecutiveDays >= maxConsecutiveDays - 1) {
      const startDate = subDays(weekEnd, consecutiveDays - 1)

      warnings.push({
        staffId: staff.id,
        staffName: staff.name || '직원',
        consecutiveDays,
        startDate,
        endDate: weekEnd,
        isOverLimit: false,
        remainingDays: maxConsecutiveDays - consecutiveDays
      })

      console.log(`   📌 ${staff.name}: ${consecutiveDays}일 연속 근무 (곧 한계 도달)`)
    }
  }

  if (warnings.length === 0) {
    console.log(`   ✅ 모든 직원 연속 근무일 정상`)
  }

  return warnings
}

/**
 * 자동 오프 배정 (연속 근무일 초과 방지)
 */
export async function autoAssignOffForOverwork(
  clinicId: string,
  weekStart: Date,
  weekEnd: Date,
  maxConsecutiveDays: number = 6
): Promise<{
  assigned: number
  staffList: Array<{ staffId: string; staffName: string; assignedDate: Date }>
}> {
  console.log(`\n🤖 자동 오프 배정 (과로 방지)`)

  const warnings = await checkConsecutiveWorkInWeek(
    clinicId,
    weekStart,
    weekEnd,
    maxConsecutiveDays
  )

  const assigned: Array<{ staffId: string; staffName: string; assignedDate: Date }> = []

  for (const warning of warnings) {
    if (warning.isOverLimit) {
      // 가장 마지막 날에 오프 배정
      const offDate = warning.endDate

      // 이미 배정된 것이 있는지 확인
      const existing = await prisma.staffAssignment.findFirst({
        where: {
          staffId: warning.staffId,
          date: offDate
        }
      })

      if (existing) {
        // 기존 배정을 OFF로 변경
        await prisma.staffAssignment.update({
          where: { id: existing.id },
          data: {
            shiftType: 'OFF',
            assignedBy: 'AUTO'
          }
        })
      } else {
        // 새로 OFF 배정
        await prisma.staffAssignment.create({
          data: {
            staffId: warning.staffId,
            date: offDate,
            shiftType: 'OFF',
            assignedBy: 'AUTO'
          }
        })
      }

      assigned.push({
        staffId: warning.staffId,
        staffName: warning.staffName,
        assignedDate: offDate
      })

      console.log(`   ✅ ${warning.staffName}: ${offDate.toISOString().split('T')[0]} 오프 배정`)
    }
  }

  console.log(`\n📊 자동 오프 배정 완료: ${assigned.length}건`)

  return {
    assigned: assigned.length,
    staffList: assigned
  }
}

/**
 * 연속 근무일 통계
 */
export async function getConsecutiveWorkStats(
  clinicId: string,
  targetDate: Date
): Promise<{
  averageConsecutiveDays: number
  maxConsecutiveDays: number
  staffWithMostDays: { staffName: string; days: number } | null
  overLimitCount: number
}> {
  const staffList = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: {
      id: true,
      name: true
    }
  })

  const consecutiveDaysList = await Promise.all(
    staffList.map(async (staff) => ({
      staffId: staff.id,
      staffName: staff.name || '직원',
      days: await calculateConsecutiveWorkDays(staff.id, targetDate)
    }))
  )

  const totalDays = consecutiveDaysList.reduce((sum, item) => sum + item.days, 0)
  const averageConsecutiveDays = staffList.length > 0 ? totalDays / staffList.length : 0

  const maxDays = Math.max(...consecutiveDaysList.map(item => item.days))
  const staffWithMostDays = consecutiveDaysList.find(item => item.days === maxDays) || null

  const overLimitCount = consecutiveDaysList.filter(item => item.days > 6).length

  return {
    averageConsecutiveDays: Math.round(averageConsecutiveDays * 10) / 10,
    maxConsecutiveDays: maxDays,
    staffWithMostDays,
    overLimitCount
  }
}
