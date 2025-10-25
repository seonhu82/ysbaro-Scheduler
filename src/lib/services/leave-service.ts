// 연차 서비스 ⭐⭐

import { prisma } from '@/lib/prisma'

/**
 * 슬롯 가용성 확인
 * 해당 날짜에 신청 가능한 슬롯이 있는지 확인
 */
export async function checkSlotAvailability(linkId: string, date: Date): Promise<{
  available: boolean
  total: number
  used: number
  remaining: number
}> {
  // 공개 링크로 clinicId 조회
  const link = await prisma.leaveApplicationLink.findUnique({
    where: { token: linkId },
    include: { clinic: true }
  })

  if (!link) {
    return { available: false, total: 0, used: 0, remaining: 0 }
  }

  // 해당 날짜의 DailySlot 조회
  const slot = await prisma.dailySlot.findFirst({
    where: {
      week: { clinicId: link.clinicId },
      date: {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999))
      }
    }
  })

  if (!slot) {
    return { available: false, total: 0, used: 0, remaining: 0 }
  }

  // 해당 날짜에 승인된 연차 신청 수 조회
  const approvedApplications = await prisma.leaveApplication.count({
    where: {
      date: {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999))
      },
      status: { in: ['PENDING', 'APPROVED'] }, // 승인 대기 + 승인됨
      staff: { clinicId: link.clinicId }
    }
  })

  const total = slot.requiredStaff
  const used = approvedApplications
  const remaining = Math.max(0, total - used)

  return {
    available: remaining > 0,
    total,
    used,
    remaining
  }
}

/**
 * 주 2일 오프 제한 확인
 * 해당 주에 이미 2일의 오프를 신청했는지 확인
 */
export async function checkWeeklyOffLimit(
  linkId: string,
  staffId: string,
  date: Date
): Promise<{
  canApply: boolean
  currentCount: number
  maxCount: number
  dates: Date[]
}> {
  const maxCount = 2

  // 주의 시작일과 종료일 계산 (일요일 시작)
  const dayOfWeek = date.getDay()
  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  // 해당 주에 신청한 오프 조회
  const offApplications = await prisma.leaveApplication.findMany({
    where: {
      staffId,
      leaveType: 'OFF',
      date: {
        gte: weekStart,
        lte: weekEnd
      },
      status: { in: ['PENDING', 'APPROVED'] } // 대기 + 승인만 카운트
    },
    orderBy: { date: 'asc' }
  })

  const currentCount = offApplications.length
  const dates = offApplications.map(app => app.date)

  return {
    canApply: currentCount < maxCount,
    currentCount,
    maxCount,
    dates
  }
}

export async function isHoliday(clinicId: string, date: Date): Promise<boolean> {
  const dayOfWeek = date.getDay()
  if (dayOfWeek === 0) return true // 일요일

  const holiday = await prisma.holiday.findFirst({
    where: {
      clinicId,
      date: {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    },
  })

  return !!holiday
}
