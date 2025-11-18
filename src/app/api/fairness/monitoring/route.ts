/**
 * 형평성 모니터링 API
 * GET /api/fairness/monitoring
 *
 * Query params:
 * - year: 연도
 * - month: 월
 *
 * Returns:
 * - staffFairness: 전체 직원 형평성 데이터
 * - categoryStats: 카테고리별 통계
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Admin 또는 Manager만 접근 가능
    const userRole = (session.user as any).role
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const clinicId = (session.user as any).clinicId

    // 현재 연도/월 사용 (누적 편차)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // 형평성 설정 조회
    const fairnessSettings = await prisma.fairnessSettings.findUnique({
      where: { clinicId }
    })

    const useHolidayFairness = fairnessSettings?.enableHolidayFairness ?? false

    // 자동배치 대상 부서 조회
    const autoDepartments = await prisma.department.findMany({
      where: {
        clinicId,
        useAutoAssignment: true
      },
      select: {
        name: true
      }
    })

    const autoDepartmentNames = autoDepartments.map(d => d.name)

    if (autoDepartmentNames.length === 0) {
      return NextResponse.json({
        success: true,
        staffFairness: [],
        categoryStats: [],
        useHolidayFairness
      })
    }

    // StaffCategory의 priority 정보 조회 (정렬용)
    const staffCategories = await prisma.staffCategory.findMany({
      where: { clinicId },
      select: {
        name: true,
        priority: true
      }
    })

    const categoryPriorityMap = new Map(
      staffCategories.map(cat => [cat.name, cat.priority])
    )

    // 자동배치 대상 부서의 활성 직원만 조회 (누적 편차 포함)
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: {
          in: autoDepartmentNames
        }
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

    // priority에 따라 정렬 (팀장 → 고년 → 중간 → 저년)
    allStaff.sort((a, b) => {
      const priorityA = categoryPriorityMap.get(a.categoryName || '') ?? 999
      const priorityB = categoryPriorityMap.get(b.categoryName || '') ?? 999
      if (priorityA !== priorityB) return priorityA - priorityB
      // priority가 같으면 이름순
      return (a.name || '').localeCompare(b.name || '')
    })

    console.log(`\n📊 형평성 모니터링 (누적 편차)`)
    console.log(`   - 대상 부서: ${autoDepartmentNames.join(', ')}`)
    console.log(`   - 대상 직원: ${allStaff.length}명\n`)

    // Staff 테이블에 저장된 누적 편차 사용
    const staffFairness = allStaff.map((staff) => {
      const getStatus = (deviation: number) => {
        if (deviation < -0.5) return 'behind'
        if (deviation > 0.5) return 'ahead'
        return 'onTrack'
      }

      return {
        staffId: staff.id,
        staffName: staff.name,
        categoryName: staff.categoryName || 'Unknown',
        departmentName: staff.departmentName || 'Unknown',
        dimensions: {
          total: {
            actual: 0, // 모니터링에서는 편차만 표시
            baseline: 0,
            deviation: Math.round(staff.fairnessScoreTotalDays * 10) / 10,
            status: getStatus(staff.fairnessScoreTotalDays)
          },
          night: {
            actual: 0,
            baseline: 0,
            deviation: Math.round(staff.fairnessScoreNight * 10) / 10,
            status: getStatus(staff.fairnessScoreNight)
          },
          weekend: {
            actual: 0,
            baseline: 0,
            deviation: Math.round(staff.fairnessScoreWeekend * 10) / 10,
            status: getStatus(staff.fairnessScoreWeekend)
          },
          holiday: {
            actual: 0,
            baseline: 0,
            deviation: Math.round(staff.fairnessScoreHoliday * 10) / 10,
            status: getStatus(staff.fairnessScoreHoliday)
          },
          holidayAdjacent: {
            actual: 0,
            baseline: 0,
            deviation: Math.round(staff.fairnessScoreHolidayAdjacent * 10) / 10,
            status: getStatus(staff.fairnessScoreHolidayAdjacent)
          }
        }
      }
    })

    // 카테고리별 통계 계산 (편차 평균)
    const categoriesMap = new Map<string, {
      total: number[]
      night: number[]
      weekend: number[]
      holiday: number[]
      holidayAdjacent: number[]
    }>()

    staffFairness.forEach(staff => {
      const category = staff.categoryName
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, {
          total: [],
          night: [],
          weekend: [],
          holiday: [],
          holidayAdjacent: []
        })
      }
      const catData = categoriesMap.get(category)!
      catData.total.push(staff.dimensions.total.deviation)
      catData.night.push(staff.dimensions.night.deviation)
      catData.weekend.push(staff.dimensions.weekend.deviation)
      catData.holiday.push(staff.dimensions.holiday.deviation)
      catData.holidayAdjacent.push(staff.dimensions.holidayAdjacent.deviation)
    })

    const categoryStats = Array.from(categoriesMap.entries()).map(([categoryName, deviations]) => {
      const avgTotal = deviations.total.reduce((sum, d) => sum + d, 0) / deviations.total.length
      const avgNight = deviations.night.reduce((sum, d) => sum + d, 0) / deviations.night.length
      const avgWeekend = deviations.weekend.reduce((sum, d) => sum + d, 0) / deviations.weekend.length
      const avgHoliday = deviations.holiday.reduce((sum, d) => sum + d, 0) / deviations.holiday.length
      const avgHolidayAdjacent = deviations.holidayAdjacent.reduce((sum, d) => sum + d, 0) / deviations.holidayAdjacent.length

      return {
        categoryName,
        staffCount: deviations.night.length,
        avgTotal: Math.round(avgTotal * 10) / 10,
        avgNight: Math.round(avgNight * 10) / 10,
        avgWeekend: Math.round(avgWeekend * 10) / 10,
        avgHoliday: Math.round(avgHoliday * 10) / 10,
        avgHolidayAdjacent: Math.round(avgHolidayAdjacent * 10) / 10
      }
    })

    console.log(`\n✅ 형평성 모니터링 완료:`)
    console.log(`   - 카테고리: ${categoryStats.length}개`)
    categoryStats.forEach(cat => {
      console.log(`   - ${cat.categoryName}: 야간 ${cat.avgNight}, 주말 ${cat.avgWeekend}, 공휴일 ${cat.avgHoliday}, 인접 ${cat.avgHolidayAdjacent}`)
    })
    console.log()

    return NextResponse.json({
      success: true,
      staffFairness,
      categoryStats,
      useHolidayFairness
    })

  } catch (error) {
    console.error('Fairness monitoring error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fairness monitoring data' },
      { status: 500 }
    )
  }
}
