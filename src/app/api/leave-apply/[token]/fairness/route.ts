/**
 * 공개 연차/오프 신청 - 형평성 정보 API
 * GET /api/leave-apply/[token]/fairness?staffId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: '직원 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // Token 검증
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 직원 정보 조회 (누적 형평성 점수 포함)
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        clinicId: link.clinicId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        departmentName: true,
        fairnessScoreTotalDays: true,
        fairnessScoreNight: true,
        fairnessScoreWeekend: true,
        fairnessScoreHoliday: true,
        fairnessScoreHolidayAdjacent: true,
        totalAnnualDays: true,
        usedAnnualDays: true,
      }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 누적 형평성 점수 사용 (10월까지의 누적)
    const cumulativeFairness = {
      total: staff.fairnessScoreTotalDays || 0,
      night: staff.fairnessScoreNight || 0,
      weekend: staff.fairnessScoreWeekend || 0,
      holiday: staff.fairnessScoreHoliday || 0,
      holidayAdjacent: staff.fairnessScoreHolidayAdjacent || 0,
    }

    // 형평성 설정 조회
    const fairnessSettings = await prisma.fairnessSettings.findUnique({
      where: { clinicId: link.clinicId }
    })

    // 신청 기간 계산
    const year = link.year
    const month = link.month

    // 정기 휴무일 설정 조회
    const closedDaySettings = await prisma.closedDaySettings.findUnique({
      where: { clinicId: link.clinicId },
      select: { regularDays: true }
    })
    const regularClosedDays = (closedDaySettings?.regularDays as number[]) || [0]

    // 해당 월 총 근무일 계산
    let workingDays = 0
    for (let day = 1; day <= new Date(year, month, 0).getDate(); day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay()
      if (!regularClosedDays.includes(dayOfWeek)) {
        workingDays++
      }
    }

    // 같은 부서 전체 직원의 누적 형평성 편차 평균 계산
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        isActive: true,
        departmentName: staff.departmentName
      },
      select: {
        id: true,
        fairnessScoreTotalDays: true,
      }
    })

    // 누적 편차 평균 계산
    let totalDeviation = 0
    let staffCount = 0
    for (const s of allStaff) {
      if (s.fairnessScoreTotalDays !== null) {
        totalDeviation += s.fairnessScoreTotalDays
        staffCount++
      }
    }

    const avgFairnessScore = staffCount > 0 ? totalDeviation / staffCount : 0

    // 현재 직원의 누적 편차 (양수 = 덜 일함 = 더 신청 가능, 음수 = 많이 일함 = 덜 신청 가능)
    const myFairnessScore = cumulativeFairness.total
    const scoreDifference = myFairnessScore - avgFairnessScore // 내 점수 - 평균 점수

    const baseAllowance = Math.floor(workingDays * 0.3) // 기본 30%
    const fairnessBonus = Math.floor(scoreDifference / 2) // 점수 2점 차이마다 1일 추가
    const maxAllowedDays = Math.max(0, baseAllowance + fairnessBonus)

    // 11월 마지막 날
    const lastDayOfMonth = new Date(year, month, 0).getDate()

    // 이미 신청한 오프 일수 계산
    const appliedOffs = await prisma.leaveApplication.count({
      where: {
        staffId: staff.id,
        linkId: link.id,
        status: 'CONFIRMED',
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month - 1, lastDayOfMonth),
        }
      }
    })

    // 각 형평성별 커트라인 정보 계산
    const fairnessCutoffs = {
      totalDays: null as { total: number, minRequired: number, maxAllowed: number } | null,
      night: null as { total: number, minRequired: number, maxAllowed: number } | null,
      weekend: null as { total: number, minRequired: number, maxAllowed: number } | null,
      holiday: null as { total: number, minRequired: number, maxAllowed: number } | null,
      holidayAdjacent: null as { total: number, minRequired: number, maxAllowed: number } | null,
    }

    // 총 근무일 형평성 (항상 계산)
    if (staff.fairnessScoreTotalDays !== null) {
      const totalWorkDays = workingDays
      const baseReq = totalWorkDays / allStaff.length
      const adjustedReq = Math.max(0, Math.floor(baseReq + staff.fairnessScoreTotalDays))
      fairnessCutoffs.totalDays = {
        total: totalWorkDays,
        minRequired: adjustedReq,
        maxAllowed: Math.max(0, totalWorkDays - adjustedReq)
      }
    }

    // 야간 형평성
    if (fairnessSettings?.enableNightShiftFairness && staff.fairnessScoreNight !== null) {
      const nightShiftDates = await prisma.scheduleDoctor.count({
        where: {
          schedule: { clinicId: link.clinicId, year, month },
          hasNightShift: true
        },
        distinct: ['date']
      })
      const baseReq = nightShiftDates / allStaff.length
      const adjustedReq = Math.max(0, Math.floor(baseReq + staff.fairnessScoreNight))
      fairnessCutoffs.night = {
        total: nightShiftDates,
        minRequired: adjustedReq,
        maxAllowed: Math.max(0, nightShiftDates - adjustedReq)
      }
    }

    // 주말 형평성
    if (fairnessSettings?.enableWeekendFairness && staff.fairnessScoreWeekend !== null) {
      let saturdays = 0
      for (let day = 1; day <= lastDayOfMonth; day++) {
        const date = new Date(year, month - 1, day)
        if (date.getDay() === 6) saturdays++
      }
      const baseReq = saturdays / allStaff.length
      const adjustedReq = Math.max(0, Math.floor(baseReq + staff.fairnessScoreWeekend))
      fairnessCutoffs.weekend = {
        total: saturdays,
        minRequired: adjustedReq,
        maxAllowed: Math.max(0, saturdays - adjustedReq)
      }
    }

    // 공휴일 형평성
    if (fairnessSettings?.enableHolidayFairness && staff.fairnessScoreHoliday !== null) {
      const holidays = await prisma.holiday.count({
        where: {
          clinicId: link.clinicId,
          date: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month - 1, lastDayOfMonth)
          }
        }
      })
      const baseReq = holidays / allStaff.length
      const adjustedReq = Math.max(0, Math.floor(baseReq + staff.fairnessScoreHoliday))
      fairnessCutoffs.holiday = {
        total: holidays,
        minRequired: adjustedReq,
        maxAllowed: Math.max(0, holidays - adjustedReq)
      }
    }

    // 공휴일 전후 형평성
    if (fairnessSettings?.enableHolidayAdjacentFairness && staff.fairnessScoreHolidayAdjacent !== null) {
      const holidays = await prisma.holiday.findMany({
        where: {
          clinicId: link.clinicId,
          date: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month - 1, lastDayOfMonth)
          }
        },
        select: { date: true }
      })

      const adjacentDates = new Set<string>()
      for (const { date } of holidays) {
        const dayOfWeek = date.getDay()
        if (dayOfWeek === 1) { // 월요일이면 전날 금요일
          const friday = new Date(date)
          friday.setDate(friday.getDate() - 3)
          adjacentDates.add(friday.toISOString().split('T')[0])
        }
        if (dayOfWeek === 5) { // 금요일이면 다음날 월요일
          const monday = new Date(date)
          monday.setDate(monday.getDate() + 3)
          adjacentDates.add(monday.toISOString().split('T')[0])
        }
      }

      const baseReq = adjacentDates.size / allStaff.length
      const adjustedReq = Math.max(0, Math.floor(baseReq + staff.fairnessScoreHolidayAdjacent))
      fairnessCutoffs.holidayAdjacent = {
        total: adjacentDates.size,
        minRequired: adjustedReq,
        maxAllowed: Math.max(0, adjacentDates.size - adjustedReq)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        staffName: staff.name,
        targetMonth: `${link.month}월`,
        fairnessScores: {
          totalDays: cumulativeFairness.total,
          night: cumulativeFairness.night,
          weekend: cumulativeFairness.weekend,
          holiday: cumulativeFairness.holiday,
          holidayAdjacent: cumulativeFairness.holidayAdjacent,
        },
        fairnessCutoffs,
        monthlyStats: {
          workingDays,
          appliedOffs,
          maxAllowedDays,
          remainingDays: Math.max(0, maxAllowedDays - appliedOffs),
          avgFairnessScore: Math.round(avgFairnessScore * 10) / 10, // 소수점 1자리
          myFairnessScore,
        },
        annualLeave: {
          total: staff.totalAnnualDays,
          used: staff.usedAnnualDays,
          remaining: staff.totalAnnualDays - staff.usedAnnualDays,
        },
        fairnessSettings: fairnessSettings ? {
          enableNightShift: fairnessSettings.enableNightShiftFairness,
          enableWeekend: fairnessSettings.enableWeekendFairness,
          enableHoliday: fairnessSettings.enableHolidayFairness,
          enableHolidayAdjacent: fairnessSettings.enableHolidayAdjacentFairness,
        } : null,
      }
    })
  } catch (error: any) {
    console.error('형평성 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '형평성 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
