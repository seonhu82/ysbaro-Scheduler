/**
 * 내 형평성 점수 API
 * GET: 직원의 월별 형평성 점수 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: '직원 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // 토큰으로 링크 조회
    const link = await prisma.scheduleViewLink.findUnique({
      where: { token: params.token }
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 만료 확인
    if (link.expiresAt && link.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: '만료된 링크입니다' },
        { status: 401 }
      )
    }

    // 직원 확인
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        clinicId: link.clinicId,
        isActive: true
      }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 형평성 설정 조회
    const fairnessSettings = await prisma.fairnessSettings.findUnique({
      where: { clinicId: link.clinicId }
    })

    // 최근 배포된 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId: link.clinicId,
        status: 'DEPLOYED'
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    })

    if (!schedule) {
      return NextResponse.json({
        success: false,
        error: '배포된 스케줄이 없습니다'
      }, { status: 404 })
    }

    // 월별 형평성 데이터에서 해당 직원의 deviation 가져오기
    const monthlyFairness = schedule.monthlyFairness as any || {}
    const staffFairness = monthlyFairness[staffId]

    if (!staffFairness) {
      return NextResponse.json({
        success: false,
        error: '형평성 데이터를 찾을 수 없습니다'
      }, { status: 404 })
    }

    // 당월 실제 근무 데이터
    const currentMonth = {
      totalWork: staffFairness.actual?.total || 0,
      night: staffFairness.actual?.night || 0,
      weekend: staffFairness.actual?.weekend || 0,
      holiday: staffFairness.actual?.holiday || 0,
      holidayAdjacent: staffFairness.actual?.holidayAdjacent || 0
    }

    // 당월 편차
    const currentDeviation = {
      total: staffFairness.deviation?.total || 0,
      night: staffFairness.deviation?.night || 0,
      weekend: staffFairness.deviation?.weekend || 0,
      holiday: staffFairness.deviation?.holiday || 0,
      holidayAdjacent: staffFairness.deviation?.holidayAdjacent || 0
    }

    // 누적 데이터 (cumulativeActual 필드 사용)
    const cumulative = {
      totalWork: staffFairness.cumulativeActual?.total || currentMonth.totalWork,
      night: staffFairness.cumulativeActual?.night || currentMonth.night,
      weekend: staffFairness.cumulativeActual?.weekend || currentMonth.weekend,
      holiday: staffFairness.cumulativeActual?.holiday || currentMonth.holiday,
      holidayAdjacent: staffFairness.cumulativeActual?.holidayAdjacent || currentMonth.holidayAdjacent
    }

    // 누적 편차 (cumulativeDeviation 필드 사용)
    const cumulativeDeviation = {
      total: staffFairness.cumulativeDeviation || currentDeviation.total,
      night: staffFairness.cumulativeDeviationDetails?.night || currentDeviation.night,
      weekend: staffFairness.cumulativeDeviationDetails?.weekend || currentDeviation.weekend,
      holiday: staffFairness.cumulativeDeviationDetails?.holiday || currentDeviation.holiday,
      holidayAdjacent: staffFairness.cumulativeDeviationDetails?.holidayAdjacent || currentDeviation.holidayAdjacent
    }

    // 당월 연차/오프 조회
    const startDate = new Date(schedule.year, schedule.month - 1, 1)
    const endDate = new Date(schedule.year, schedule.month, 0)

    const assignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staffId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    const currentMonthStats = {
      annual: assignments.filter(a => a.shiftType === 'ANNUAL').length,
      off: assignments.filter(a => a.shiftType === 'OFF').length
    }

    // 누적 연차/오프 조회 (올해 전체)
    const yearStart = new Date(schedule.year, 0, 1)
    const yearEnd = new Date(schedule.year, schedule.month, 0) // 현재 월까지

    const yearAssignments = await prisma.staffAssignment.findMany({
      where: {
        staffId,
        date: {
          gte: yearStart,
          lte: yearEnd
        },
        schedule: {
          clinicId: link.clinicId,
          status: 'DEPLOYED'
        }
      }
    })

    const cumulativeStats = {
      annual: yearAssignments.filter(a => a.shiftType === 'ANNUAL').length,
      off: yearAssignments.filter(a => a.shiftType === 'OFF').length
    }

    // 부서 평균 편차 계산
    const departmentStaff = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        departmentName: staff.departmentName,
        isActive: true
      },
      select: { id: true }
    })

    let departmentDeviationSum = 0
    let departmentStaffCount = 0

    for (const deptStaff of departmentStaff) {
      const deptFairness = monthlyFairness[deptStaff.id]
      if (deptFairness && deptFairness.deviation) {
        departmentDeviationSum += deptFairness.deviation.total || 0
        departmentStaffCount++
      }
    }

    const averageDeviation = departmentStaffCount > 0
      ? departmentDeviationSum / departmentStaffCount
      : 0

    return NextResponse.json({
      success: true,
      data: {
        year: schedule.year,
        month: schedule.month,
        staffInfo: {
          name: staff.name,
          rank: staff.rank || staff.departmentName
        },
        fairnessSettings: {
          enableNightShiftFairness: fairnessSettings?.enableNightShiftFairness ?? true,
          enableWeekendFairness: fairnessSettings?.enableWeekendFairness ?? true,
          enableHolidayFairness: fairnessSettings?.enableHolidayFairness ?? true,
          enableHolidayAdjacentFairness: fairnessSettings?.enableHolidayAdjacentFairness ?? false
        },
        currentMonth: {
          totalWork: currentMonth.totalWork,
          annual: currentMonthStats.annual,
          off: currentMonthStats.off,
          night: currentMonth.night,
          weekend: currentMonth.weekend,
          holiday: currentMonth.holiday,
          holidayAdjacent: currentMonth.holidayAdjacent,
          deviation: {
            total: Math.round(currentDeviation.total * 10) / 10,
            night: Math.round(currentDeviation.night * 10) / 10,
            weekend: Math.round(currentDeviation.weekend * 10) / 10,
            holiday: Math.round(currentDeviation.holiday * 10) / 10,
            holidayAdjacent: Math.round(currentDeviation.holidayAdjacent * 10) / 10
          }
        },
        cumulative: {
          totalWork: cumulative.totalWork,
          annual: cumulativeStats.annual,
          off: cumulativeStats.off,
          night: cumulative.night,
          weekend: cumulative.weekend,
          holiday: cumulative.holiday,
          holidayAdjacent: cumulative.holidayAdjacent,
          deviation: {
            total: Math.round(cumulativeDeviation.total * 10) / 10,
            night: Math.round(cumulativeDeviation.night * 10) / 10,
            weekend: Math.round(cumulativeDeviation.weekend * 10) / 10,
            holiday: Math.round(cumulativeDeviation.holiday * 10) / 10,
            holidayAdjacent: Math.round(cumulativeDeviation.holidayAdjacent * 10) / 10
          }
        },
        averageDeviation: Math.round(averageDeviation * 10) / 10
      }
    })
  } catch (error: any) {
    console.error('형평성 점수 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '형평성 점수 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
