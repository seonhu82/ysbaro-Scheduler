/**
 * 직원의 월별 근무일 수 조회 API (타입별 상세)
 * GET: 특정 직원의 해당 월 근무일 수와 평균 근무일 수 반환 (일반/야근/공휴일/주말 구분)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'

// 공휴일 판단 함수 (간단한 예시 - 실제로는 ClosedDaySettings에서 가져와야 함)
function isHoliday(date: Date): boolean {
  // 임시: 일요일을 공휴일로 간주
  return date.getDay() === 0
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // 일요일 또는 토요일
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')
    const includeHoliday = searchParams.get('includeHoliday') === 'true' // 공휴일 체크 활성화 여부

    if (!staffId || !year || !month) {
      return badRequestResponse('staffId, year, month are required')
    }

    const clinicId = session.user.clinicId

    // 해당 월의 시작일과 종료일
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)

    // 해당 직원의 이번 달 모든 근무 조회
    const staffAssignments = await prisma.staffAssignment.findMany({
      where: {
        staffId,
        date: {
          gte: monthStart,
          lte: monthEnd
        },
        shiftType: {
          in: ['DAY', 'NIGHT']
        }
      },
      select: {
        date: true,
        shiftType: true
      }
    })

    // 타입별 집계
    let regularCount = 0 // 일반 근무 (평일 주간)
    let nightCount = 0 // 야근
    let holidayCount = 0 // 공휴일 근무
    let weekendCount = 0 // 주말 근무

    for (const assignment of staffAssignments) {
      const isNight = assignment.shiftType === 'NIGHT'
      const isHol = includeHoliday && isHoliday(assignment.date)
      const isWknd = isWeekend(assignment.date)

      if (isNight) {
        nightCount++
      } else if (isHol) {
        holidayCount++
      } else if (isWknd) {
        weekendCount++
      } else {
        regularCount++
      }
    }

    const totalWorkDays = staffAssignments.length

    // 전체 진료실 직원의 평균 근무일 수 계산 (타입별)
    const allTreatmentStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      },
      select: { id: true }
    })

    let totalRegular = 0
    let totalNight = 0
    let totalHoliday = 0
    let totalWeekend = 0

    for (const staff of allTreatmentStaff) {
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          staffId: staff.id,
          date: {
            gte: monthStart,
            lte: monthEnd
          },
          shiftType: {
            in: ['DAY', 'NIGHT']
          }
        },
        select: {
          date: true,
          shiftType: true
        }
      })

      for (const assignment of assignments) {
        const isNight = assignment.shiftType === 'NIGHT'
        const isHol = includeHoliday && isHoliday(assignment.date)
        const isWknd = isWeekend(assignment.date)

        if (isNight) {
          totalNight++
        } else if (isHol) {
          totalHoliday++
        } else if (isWknd) {
          totalWeekend++
        } else {
          totalRegular++
        }
      }
    }

    const staffCount = allTreatmentStaff.length

    const avgRegular = staffCount > 0 ? totalRegular / staffCount : 0
    const avgNight = staffCount > 0 ? totalNight / staffCount : 0
    const avgHoliday = staffCount > 0 ? totalHoliday / staffCount : 0
    const avgWeekend = staffCount > 0 ? totalWeekend / staffCount : 0
    const avgTotal = staffCount > 0 ? (totalRegular + totalNight + totalHoliday + totalWeekend) / staffCount : 0

    return successResponse({
      current: {
        regular: regularCount,
        night: nightCount,
        holiday: holidayCount,
        weekend: weekendCount,
        total: totalWorkDays
      },
      average: {
        regular: avgRegular,
        night: avgNight,
        holiday: avgHoliday,
        weekend: avgWeekend,
        total: avgTotal
      },
      deviation: {
        regular: regularCount - avgRegular,
        night: nightCount - avgNight,
        holiday: holidayCount - avgHoliday,
        weekend: weekendCount - avgWeekend,
        total: totalWorkDays - avgTotal
      }
    })

  } catch (error) {
    console.error('Get work days error:', error)
    return errorResponse('Failed to get work days', 500)
  }
}
