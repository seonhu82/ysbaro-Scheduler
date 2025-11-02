/**
 * 직원별 근무일수 통계 API
 * GET: 특정 월의 직원별 근무일수 통계 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'
import { calculateStaffFairnessV2 } from '@/lib/services/fairness-calculator-v2'

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

    // 직원별 연차/오프 맵 생성
    const staffLeaveMap = new Map<string, { annualDays: number; offDays: number }>()
    console.log(`📊 LeaveApplications found: ${leaveApplications.length}`)
    for (const leave of leaveApplications) {
      if (!staffLeaveMap.has(leave.staffId)) {
        staffLeaveMap.set(leave.staffId, { annualDays: 0, offDays: 0 })
      }
      const leaveStats = staffLeaveMap.get(leave.staffId)!
      if (leave.leaveType === 'ANNUAL') {
        leaveStats.annualDays++
        console.log(`📊 ANNUAL leave for staff ${leave.staffId}`)
      } else if (leave.leaveType === 'OFF') {
        leaveStats.offDays++
        console.log(`📊 OFF leave for staff ${leave.staffId}`)
      }
    }
    console.log(`📊 staffLeaveMap size: ${staffLeaveMap.size}`, Array.from(staffLeaveMap.entries()))

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

    // 모든 진료실 활성 직원 조회
    const allTreatmentStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      },
      select: {
        id: true,
        name: true,
        categoryName: true,
        departmentName: true
      }
    })

    // 직원별로 그룹화하여 통계 계산 (모든 진료실 직원 먼저 초기화)
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

    // 모든 진료실 직원 초기화
    for (const staff of allTreatmentStaff) {
      const leaveStats = staffLeaveMap.get(staff.id) || { annualDays: 0, offDays: 0 }
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
        annualDays: leaveStats.annualDays,
        offDays: leaveStats.offDays
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
      if (!stats) continue // 진료실 직원이 아니면 스킵

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

    // Map을 배열로 변환하고 카테고리별로 정렬
    const categoryOrder: { [key: string]: number } = {
      '팀장/실장': 0,
      '고년차': 1,
      '중간년차': 2,
      '저년차': 3
    }

    const stats = Array.from(staffStatsMap.values()).sort((a, b) => {
      // 진료실 직원만 표시 (필터링)
      const deptA = a.departmentName === '진료실' ? 0 : 1
      const deptB = b.departmentName === '진료실' ? 0 : 1
      if (deptA !== deptB) return deptA - deptB

      // 카테고리별 정렬
      const orderA = categoryOrder[a.categoryName] ?? 999
      const orderB = categoryOrder[b.categoryName] ?? 999
      if (orderA !== orderB) return orderA - orderB

      // 이름순 정렬
      return a.staffName.localeCompare(b.staffName)
    }).filter(s => s.departmentName === '진료실') // 진료실만 표시

    console.log('📊 Stats sorting result:', stats.map(s => `${s.staffName}(${s.categoryName})`))

    // 샘플 직원의 연차/오프 확인
    const sampleStats = stats.slice(0, 3)
    console.log('📊 Sample stats with leave:', sampleStats.map(s => ({
      name: s.staffName,
      annual: s.annualDays,
      off: s.offDays,
      total: s.totalDays
    })))

    // 형평성 점수 계산 (V2 사용)
    const statsWithFairness = await Promise.all(
      stats.map(async (stat) => {
        const fairness = await calculateStaffFairnessV2(
          stat.staffId,
          clinicId,
          year,
          month,
          '진료실'
        )

        return {
          ...stat,
          fairness: {
            total: fairness.dimensions.total,
            night: fairness.dimensions.night,
            weekend: fairness.dimensions.weekend,
            holiday: fairness.dimensions.holiday,
            holidayAdjacent: fairness.dimensions.holidayAdjacent,
            overallScore: fairness.overallScore // Step 3과 동일한 점수 사용
          }
        }
      })
    )

    return successResponse({
      stats: statsWithFairness,
      enabledDimensions // 활성화된 형평성 차원
    })

  } catch (error) {
    console.error('Get staff stats error:', error)
    return errorResponse('Failed to fetch staff stats', 500)
  }
}
