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
import { calculateStaffFairnessV2 } from '@/lib/services/fairness-calculator-v2'
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

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month are required' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    // 모든 활성 직원 조회
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true
      },
      orderBy: {
        categoryName: 'asc'
      }
    })

    console.log(`\n📊 형평성 모니터링: ${year}년 ${month}월`)
    console.log(`   - 대상 직원: ${allStaff.length}명\n`)

    // 각 직원의 형평성 점수 계산
    const staffFairnessPromises = allStaff.map(async (staff) => {
      const fairness = await calculateStaffFairnessV2(staff.id, clinicId, year, month)
      return {
        staffId: staff.id,
        staffName: staff.name,
        categoryName: staff.categoryName || 'Unknown',
        overallScore: fairness.overallScore,
        dimensions: {
          night: {
            actual: fairness.dimensions.night.actual,
            baseline: fairness.dimensions.night.baseline,
            deviation: fairness.dimensions.night.deviation,
            status: fairness.dimensions.night.status
          },
          weekend: {
            actual: fairness.dimensions.weekend.actual,
            baseline: fairness.dimensions.weekend.baseline,
            deviation: fairness.dimensions.weekend.deviation,
            status: fairness.dimensions.weekend.status
          },
          holiday: {
            actual: fairness.dimensions.holiday.actual,
            baseline: fairness.dimensions.holiday.baseline,
            deviation: fairness.dimensions.holiday.deviation,
            status: fairness.dimensions.holiday.status
          },
          holidayAdjacent: {
            actual: fairness.dimensions.holidayAdjacent.actual,
            baseline: fairness.dimensions.holidayAdjacent.baseline,
            deviation: fairness.dimensions.holidayAdjacent.deviation,
            status: fairness.dimensions.holidayAdjacent.status
          }
        }
      }
    })

    const staffFairness = await Promise.all(staffFairnessPromises)

    // 카테고리별 통계 계산
    const categoriesMap = new Map<string, number[]>()

    staffFairness.forEach(staff => {
      const category = staff.categoryName
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, [])
      }
      categoriesMap.get(category)!.push(staff.overallScore)
    })

    const categoryStats = Array.from(categoriesMap.entries()).map(([categoryName, scores]) => {
      const averageScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      const minScore = Math.min(...scores)
      const maxScore = Math.max(...scores)

      return {
        categoryName,
        averageScore,
        staffCount: scores.length,
        minScore,
        maxScore
      }
    })

    console.log(`\n✅ 형평성 모니터링 완료:`)
    console.log(`   - 카테고리: ${categoryStats.length}개`)
    categoryStats.forEach(cat => {
      console.log(`   - ${cat.categoryName}: 평균 ${cat.averageScore}점 (${cat.minScore}-${cat.maxScore})`)
    })
    console.log()

    return NextResponse.json({
      success: true,
      staffFairness,
      categoryStats
    })

  } catch (error) {
    console.error('Fairness monitoring error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fairness monitoring data' },
      { status: 500 }
    )
  }
}
