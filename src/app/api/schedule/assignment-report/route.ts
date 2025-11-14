/**
 * 직원 배치 결과 리포트 API
 * GET: 특정 월의 배치 결과 분석 리포트 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Week key generation (Sunday-based week) - UTC 기준
function getWeekKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const dayOfMonth = date.getUTCDate()
  const dayOfWeek = date.getUTCDay() // 0 = Sunday, 6 = Saturday

  // Get the Sunday of this week (UTC)
  const sundayOfWeek = new Date(Date.UTC(year, month, dayOfMonth - dayOfWeek))

  // Calculate week number based on first Sunday of the year (UTC)
  const firstDayOfYear = new Date(Date.UTC(sundayOfWeek.getUTCFullYear(), 0, 1))
  const firstSunday = new Date(firstDayOfYear)
  const firstDayOfWeek = firstDayOfYear.getUTCDay()

  // Adjust to first Sunday
  if (firstDayOfWeek !== 0) {
    firstSunday.setUTCDate(firstDayOfYear.getUTCDate() + (7 - firstDayOfWeek))
  }

  const diffTime = sundayOfWeek.getTime() - firstSunday.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const weekNumber = Math.floor(diffDays / 7) + 1

  return `${sundayOfWeek.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    const clinicId = session.user.clinicId

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month },
      include: {
        staffAssignments: {
          include: {
            staff: true
          }
        }
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // 병원 설정 조회
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    })

    const weekBusinessDays = clinic?.weekBusinessDays || 6
    const defaultWorkDays = clinic?.defaultWorkDays || 4

    // 형평성 설정 조회
    const fairnessSettings = await prisma.fairnessSettings.findUnique({
      where: { clinicId }
    })

    // 활성화된 형평성 항목만 포함 (가중치 1로 설정)
    const fairnessWeights: Record<string, number> = {}
    if (fairnessSettings) {
      if (fairnessSettings.enableNightShiftFairness) fairnessWeights.night = 1
      if (fairnessSettings.enableWeekendFairness) fairnessWeights.weekend = 1
      if (fairnessSettings.enableHolidayFairness) fairnessWeights.holiday = 1
      if (fairnessSettings.enableHolidayAdjacentFairness) fairnessWeights.holidayAdjacent = 1
    }

    // 전체 직원 조회
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      }
    })

    // 연차 조회
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        status: 'CONFIRMED',
        leaveType: 'ANNUAL',
        date: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1)
        }
      }
    })

    // 공휴일 조회 - 주차 범위에 맞춰 확장 (이전/다음 달 포함)
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)

    // 월 시작일이 속한 주의 일요일부터
    const firstWeekSunday = new Date(monthStart)
    const firstDayOfWeek = monthStart.getDay()
    firstWeekSunday.setDate(monthStart.getDate() - firstDayOfWeek)

    // 월 마지막일이 속한 주의 토요일까지
    const lastWeekSaturday = new Date(monthEnd)
    const lastDayOfWeek = monthEnd.getDay()
    lastWeekSaturday.setDate(monthEnd.getDate() + (6 - lastDayOfWeek))

    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: firstWeekSunday,
          lte: lastWeekSaturday
        }
      }
    })

    // 주차별 데이터 구조
    const weeklyData = new Map<string, {
      weekKey: string
      offCount: number
      workCount: number
      staffWorkDays: Map<string, number>
    }>()

    // 일요일과 공휴일 제외한 영업일 계산
    const businessDays = schedule.staffAssignments.filter(a => {
      const date = new Date(a.date)
      const dayOfWeek = date.getDay()
      return dayOfWeek !== 0 // 일요일 제외
    })

    // 배치 데이터 분석
    for (const assignment of businessDays) {
      const date = new Date(assignment.date)
      const weekKey = getWeekKey(date)

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          weekKey,
          offCount: 0,
          workCount: 0,
          staffWorkDays: new Map()
        })
      }

      const weekData = weeklyData.get(weekKey)!

      if (assignment.shiftType === 'OFF') {
        weekData.offCount++
      } else {
        weekData.workCount++

        // 직원별 근무일 카운트
        const currentCount = weekData.staffWorkDays.get(assignment.staffId) || 0
        weekData.staffWorkDays.set(assignment.staffId, currentCount + 1)
      }
    }

    // 연차도 근무일로 카운트 (주4일 계산용)
    for (const leave of leaves) {
      const date = new Date(leave.date)
      const dayOfWeek = date.getDay()

      // 일요일 제외
      if (dayOfWeek === 0) continue

      const weekKey = getWeekKey(date)

      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          weekKey,
          offCount: 0,
          workCount: 0,
          staffWorkDays: new Map()
        })
      }

      const weekData = weeklyData.get(weekKey)!
      const currentCount = weekData.staffWorkDays.get(leave.staffId) || 0
      weekData.staffWorkDays.set(leave.staffId, currentCount + 1)
    }

    // 주차별 통계 생성 (weekKey로 정렬)
    const sortedWeeklyData = Array.from(weeklyData.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    const weeklyStats = sortedWeeklyData.map(([weekKey, weekData], index) => {
      // 주차별 영업일 수 계산
      const totalAssignmentsInWeek = weekData.offCount + weekData.workCount
      const businessDaysInWeek = Math.ceil(totalAssignmentsInWeek / allStaff.length)

      const offTarget = (weekBusinessDays - defaultWorkDays) * allStaff.length
      const offComplianceRate = offTarget > 0 ? (weekData.offCount / offTarget) * 100 : 0

      // 주차 표시 형식 변경 (첫째 주, 둘째 주, ...)
      const weekNumber = index + 1
      const weekNames = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째']
      const weekLabel = weekNames[index] || `${weekNumber}번째`

      // 주차 날짜 범위 계산 (UTC 기준)
      const [yearStr, weekStr] = weekKey.split('-W')
      const weekNum = parseInt(weekStr)
      const yearNum = parseInt(yearStr)

      // 해당 연도의 첫 일요일 찾기 (UTC)
      const firstDayOfYear = new Date(Date.UTC(yearNum, 0, 1))
      const firstSunday = new Date(firstDayOfYear)
      const firstDayOfWeek = firstDayOfYear.getUTCDay()

      if (firstDayOfWeek !== 0) {
        firstSunday.setUTCDate(firstDayOfYear.getUTCDate() + (7 - firstDayOfWeek))
      }

      // 해당 주차의 일요일 (UTC)
      const weekStart = new Date(firstSunday)
      weekStart.setUTCDate(firstSunday.getUTCDate() + (weekNum - 1) * 7)

      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

      const dateRange = `${weekStart.getUTCMonth() + 1}/${weekStart.getUTCDate()}~${weekEnd.getUTCMonth() + 1}/${weekEnd.getUTCDate()}`

      // 전체 직원의 근무일 현황
      const staffWorkDetails: Array<{
        staffId: string
        staffName: string
        workDays: number
        offDays: number
      }> = []

      for (const staff of allStaff) {
        const workDays = weekData.staffWorkDays.get(staff.id) || 0

        // 연차가 있는지 확인
        const leaveCount = leaves.filter(l => {
          const leaveDate = new Date(l.date)
          return l.staffId === staff.id && getWeekKey(leaveDate) === weekKey
        }).length

        // OFF 일수 계산 (연차 포함)
        const offDays = (businessDaysInWeek - workDays) + leaveCount

        staffWorkDetails.push({
          staffId: staff.id,
          staffName: staff.name,
          workDays,
          offDays
        })
      }

      // 근무일수로 정렬
      staffWorkDetails.sort((a, b) => a.workDays - b.workDays)

      // 주4일 달성률 계산
      const fourDayStaffCount = staffWorkDetails.filter(s => s.workDays === 4).length
      const week4ComplianceRate = allStaff.length > 0
        ? Math.round((fourDayStaffCount / allStaff.length) * 100 * 10) / 10
        : 0

      // 해당 주의 공휴일 확인
      const weekHolidays = holidays.filter(h => {
        const holidayDate = new Date(h.date)
        return getWeekKey(holidayDate) === weekKey
      })

      // 공휴일로 인해 추가로 OFF 처리된 건수 계산
      // 주 전체 실제 OFF - 주 목표 OFF = 공휴일로 인한 추가 OFF
      let holidayOffCount = 0
      if (weekHolidays.length > 0) {
        const weekOffTarget = (weekBusinessDays - defaultWorkDays) * allStaff.length
        holidayOffCount = Math.max(0, weekData.offCount - weekOffTarget)
      }

      return {
        weekKey: `${weekLabel} 주 (${dateRange})`,
        offCount: weekData.offCount,
        offTarget,
        offComplianceRate: Math.round(offComplianceRate * 10) / 10,
        fourDayStaffCount,
        week4ComplianceRate,
        staffWorkDetails,
        businessDaysInWeek,
        holidays: weekHolidays.map(h => ({
          date: h.date.toISOString().split('T')[0],
          name: h.name
        })),
        holidayOffCount
      }
    })

    // 직원별 편차 분석
    const monthlyFairness = schedule.monthlyFairness as any || {}
    const staffDeviations = Object.values(monthlyFairness)
      .map((data: any) => ({
        staffId: data.staffId,
        staffName: data.staffName,
        departmentName: data.departmentName,
        categoryName: data.categoryName,
        totalDeviation: Math.round(data.deviation.total * 10) / 10,
        actualWorkDays: data.actual.total,
        averageWorkDays: Math.round((data.actual.total + data.deviation.total) * 10) / 10,
        deviationDetails: {
          night: Math.round(data.deviation.night * 10) / 10,
          weekend: Math.round(data.deviation.weekend * 10) / 10,
          holiday: Math.round(data.deviation.holiday * 10) / 10,
          holidayAdjacent: Math.round(data.deviation.holidayAdjacent * 10) / 10
        }
      }))
      .sort((a, b) => Math.abs(b.totalDeviation) - Math.abs(a.totalDeviation))

    // 상위 편차 직원 (양수/음수 각 5명)
    const positiveDeviations = staffDeviations
      .filter(s => s.totalDeviation > 0)
      .slice(0, 5)

    const negativeDeviations = staffDeviations
      .filter(s => s.totalDeviation < 0)
      .slice(0, 5)

    // 카테고리별 통계
    const categoryStats: Record<string, {
      averageWorkDays: number
      flexibleAssignments: number
      totalStaff: number
    }> = {}

    for (const staff of allStaff) {
      const category = staff.categoryName || '미지정'

      if (!categoryStats[category]) {
        categoryStats[category] = {
          averageWorkDays: 0,
          flexibleAssignments: 0,
          totalStaff: 0
        }
      }

      categoryStats[category].totalStaff++

      const staffFairness = monthlyFairness[staff.id]
      if (staffFairness) {
        categoryStats[category].averageWorkDays += staffFairness.actual.total
      }

      // 유연 배치 건수
      const flexibleCount = schedule.staffAssignments.filter(
        a => a.staffId === staff.id && a.isFlexible
      ).length

      categoryStats[category].flexibleAssignments += flexibleCount
    }

    // 평균 계산
    for (const category in categoryStats) {
      const stats = categoryStats[category]
      if (stats.totalStaff > 0) {
        stats.averageWorkDays = Math.round((stats.averageWorkDays / stats.totalStaff) * 10) / 10
      }
    }

    // 전체 요약
    const totalAssignments = schedule.staffAssignments.filter(a => a.shiftType !== 'OFF').length
    const averageFairness = staffDeviations.length > 0
      ? Math.round((staffDeviations.reduce((sum, s) => sum + Math.abs(s.totalDeviation), 0) / staffDeviations.length) * 10) / 10
      : 0

    const totalFlexibleAssignments = schedule.staffAssignments.filter(a => a.isFlexible).length

    return NextResponse.json({
      success: true,
      report: {
        summary: {
          totalAssignments,
          averageFairness,
          totalFlexibleAssignments,
          totalStaff: allStaff.length
        },
        weeklyStats,
        staffDeviations: {
          all: staffDeviations,
          topPositive: positiveDeviations,
          topNegative: negativeDeviations
        },
        categoryStats,
        fairnessWeights
      }
    })

  } catch (error) {
    console.error('Get assignment report error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get assignment report' },
      { status: 500 }
    )
  }
}
