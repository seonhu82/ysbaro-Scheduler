/**
 * 직원별 근무일수 통계 API
 * GET: 특정 월의 직원별 근무일수 통계 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'
import { calculateStaffFairnessV2 } from '@/lib/services/fairness-calculator-v2'
import { getAutoAssignDepartmentNamesWithFallback, getCategoryOrderMap } from '@/lib/utils/department-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')
    const status = searchParams.get('status') || 'DRAFT'

    if (!year || !month) {
      return errorResponse('Year and month are required', 400)
    }

    const clinicId = session.user.clinicId

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month,
        status: status as any
      }
    })

    if (!schedule) {
      return successResponse({ stats: [] })
    }

    // 직원별 배치 조회 (OFF 포함)
    const staffAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            categoryName: true,
            departmentName: true
          }
        }
      }
    })

    // 공휴일 조회
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))

    // 연차/오프 조회
    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: {
          gte: startDate,
          lte: endDate
        },
        status: 'CONFIRMED'
      }
    })

    // 직원별 연차 맵 생성 (OFF는 StaffAssignment에서만 카운트)
    const staffAnnualMap = new Map<string, number>()
    console.log(`📊 LeaveApplications found: ${leaveApplications.length}`)
    for (const leave of leaveApplications) {
      if (leave.leaveType === 'ANNUAL') {
        staffAnnualMap.set(leave.staffId, (staffAnnualMap.get(leave.staffId) || 0) + 1)
        console.log(`📊 ANNUAL leave for staff ${leave.staffId}`)
      }
      // OFF는 제외 - StaffAssignment에서 카운트됨
    }
    console.log(`📊 staffAnnualMap size: ${staffAnnualMap.size}`, Array.from(staffAnnualMap.entries()))

    // 형평성 활성 차원 조회 (FairnessSettings에서 읽기)
    const fairnessSettings = await prisma.fairnessSettings.findUnique({
      where: { clinicId }
    })

    const enabledDimensions = {
      night: fairnessSettings?.enableNightShiftFairness ?? true,
      weekend: fairnessSettings?.enableWeekendFairness ?? true,
      holiday: fairnessSettings?.enableHolidayFairness ?? true,
      holidayAdjacent: fairnessSettings?.enableHolidayAdjacentFairness ?? false
    }

    // 자동 배치 부서 조회
    const autoAssignDeptNames = await getAutoAssignDepartmentNamesWithFallback(clinicId)

    // 자동 배치 부서의 모든 활성 직원 조회 (편차 포함)
    const allTreatmentStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: { in: autoAssignDeptNames }
      },
      select: {
        id: true,
        name: true,
        categoryName: true,
        departmentName: true,
        fairnessScoreTotalDays: true,
        fairnessScoreNight: true,
        fairnessScoreWeekend: true,
        fairnessScoreHoliday: true,
        fairnessScoreHolidayAdjacent: true
      }
    })

    // 직원별로 그룹화하여 통계 계산 (자동 배치 부서의 모든 직원 먼저 초기화)
    const staffStatsMap = new Map<string, {
      staffId: string
      staffName: string
      categoryName: string
      departmentName: string
      totalDays: number
      nightShiftDays: number
      weekendDays: number
      holidayDays: number
      holidayAdjacentDays: number
      annualDays: number
      offDays: number
    }>()

    // 자동 배치 부서의 모든 직원 초기화
    for (const staff of allTreatmentStaff) {
      const annualDays = staffAnnualMap.get(staff.id) || 0
      staffStatsMap.set(staff.id, {
        staffId: staff.id,
        staffName: staff.name,
        categoryName: staff.categoryName || '미분류',
        departmentName: staff.departmentName || '미분류',
        totalDays: 0,
        nightShiftDays: 0,
        weekendDays: 0,
        holidayDays: 0,
        holidayAdjacentDays: 0,
        annualDays: annualDays,
        offDays: 0 // StaffAssignment에서 카운트됨
      })
    }

    // 근무 배정 기반 통계 계산
    for (const assignment of staffAssignments) {
      const staffId = assignment.staff.id
      const assignmentDate = new Date(assignment.date)
      const dateKey = assignmentDate.toISOString().split('T')[0]
      const dayOfWeek = assignmentDate.getDay()

      // 해당 월에 속하는 날짜만 카운팅 (전월/다음월 배정 제외)
      if (assignmentDate < startDate || assignmentDate > endDate) {
        continue
      }

      // 이미 초기화되어 있으므로 바로 가져옴
      const stats = staffStatsMap.get(staffId)
      if (!stats) continue // 자동 배치 부서 직원이 아니면 스킵

      // OFF 처리
      if (assignment.shiftType === 'OFF') {
        stats.offDays++
        continue // OFF는 다른 통계에 포함시키지 않음
      }

      // 총 근무일수 (OFF 제외)
      stats.totalDays++

      // 야간 근무
      if (assignment.shiftType === 'NIGHT') {
        stats.nightShiftDays++
      }

      // 주말 근무 (토요일=6, 일요일=0)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        stats.weekendDays++
      }

      // 공휴일 근무
      if (holidayDates.has(dateKey)) {
        stats.holidayDays++
      }

      // 공휴일 전후 근무 (휴일연장 - 공휴일 당일 제외)
      const isHolidayAdjacent = holidayDates.has(
        new Date(assignmentDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      ) || holidayDates.has(
        new Date(assignmentDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      )
      if (isHolidayAdjacent && !holidayDates.has(dateKey)) {
        stats.holidayAdjacentDays++
      }
    }

    // Map을 배열로 변환하고 부서/카테고리별로 정렬
    const categoryOrder = await getCategoryOrderMap(clinicId)
    const autoAssignDeptSet = new Set(autoAssignDeptNames)

    const stats = Array.from(staffStatsMap.values()).sort((a, b) => {
      // 부서 순서 (자동 배치 부서만 표시)
      const deptA = autoAssignDeptSet.has(a.departmentName) ? 0 : 1
      const deptB = autoAssignDeptSet.has(b.departmentName) ? 0 : 1
      if (deptA !== deptB) return deptA - deptB

      // 카테고리별 정렬 (동적으로 조회된 순서 사용)
      const orderA = categoryOrder[a.categoryName] ?? 999
      const orderB = categoryOrder[b.categoryName] ?? 999
      if (orderA !== orderB) return orderA - orderB

      // 이름순 정렬
      return a.staffName.localeCompare(b.staffName)
    }).filter(s => autoAssignDeptSet.has(s.departmentName)) // 자동 배치 부서만 표시

    console.log('📊 Stats sorting result:', stats.map(s => `${s.staffName}(${s.categoryName})`))

    // 샘플 직원의 연차/오프 확인
    const sampleStats = stats.slice(0, 3)
    console.log('📊 Sample stats with leave:', sampleStats.map(s => ({
      name: s.staffName,
      annual: s.annualDays,
      off: s.offDays,
      total: s.totalDays
    })))

    // Staff 테이블에서 편차 불러오기 및 overallScore 계산
    const statsWithFairness = stats.map((stat) => {
      const staff = allTreatmentStaff.find(s => s.id === stat.staffId)

      const deviations = {
        total: staff?.fairnessScoreTotalDays ?? 0,
        night: staff?.fairnessScoreNight ?? 0,
        weekend: staff?.fairnessScoreWeekend ?? 0,
        holiday: staff?.fairnessScoreHoliday ?? 0,
        holidayAdjacent: staff?.fairnessScoreHolidayAdjacent ?? 0
      }

      // overallScore 계산 (가중 평균) - calculateStaffFairnessV2와 동일한 방식
      const weights = { total: 2, night: 3, weekend: 2, holiday: 4, holidayAdjacent: 1 }
      const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0)
      const weightedSum =
        deviations.total * weights.total +
        deviations.night * weights.night +
        deviations.weekend * weights.weekend +
        deviations.holiday * weights.holiday +
        deviations.holidayAdjacent * weights.holidayAdjacent
      const weightedDeviation = totalWeight > 0 ? weightedSum / totalWeight : 0
      const overallScore = Math.max(0, Math.min(100, 100 - Math.abs(weightedDeviation) * 10))

      return {
        ...stat,
        fairness: {
          total: {
            deviation: deviations.total
          },
          night: {
            deviation: deviations.night
          },
          weekend: {
            deviation: deviations.weekend
          },
          holiday: {
            deviation: deviations.holiday
          },
          holidayAdjacent: {
            deviation: deviations.holidayAdjacent
          },
          overallScore: Math.round(overallScore)
        }
      }
    })

    return successResponse({
      stats: statsWithFairness,
      enabledDimensions // 활성화된 형평성 차원
    })

  } catch (error) {
    console.error('Get staff stats error:', error)
    return errorResponse('Failed to fetch staff stats', 500)
  }
}
