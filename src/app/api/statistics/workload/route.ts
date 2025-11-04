/**
 * 직원별 업무량 통계 API
 * GET /api/statistics/workload
 *
 * 특정 월의 직원별 업무량 및 형평성 점수 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateStaffFairnessV2 } from '@/lib/services/fairness-calculator-v2'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = (session.user as any).clinicId
    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    console.log(`\n📊 직원별 업무량 통계 조회: ${year}년 ${month}월`)

    // 해당 월의 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month,
        status: { in: ['DRAFT', 'DEPLOYED'] }
      }
    })

    if (!schedule) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // 진료실 직원 목록 조회
    const staffList = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      },
      select: {
        id: true,
        name: true,
        rank: true,
        categoryName: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    console.log(`   → ${staffList.length}명의 직원 처리 중...`)

    // 각 직원별로 형평성 점수 계산
    const workloadData = await Promise.all(
      staffList.map(async (staff) => {
        try {
          // 형평성 계산 (전월 편차 포함)
          const fairness = await calculateStaffFairnessV2(
            staff.id,
            clinicId,
            year,
            month,
            '진료실'
          )

          // 총 근무일, 야간, 주말 횟수
          const totalShifts = fairness.dimensions.total.actual
          const nightShifts = fairness.dimensions.night.actual
          const weekendShifts = fairness.dimensions.weekend.actual

          // 종합 점수 및 등급
          const overallScore = fairness.overallScore
          let grade = 'POOR'
          if (overallScore >= 85) grade = 'EXCELLENT'
          else if (overallScore >= 70) grade = 'GOOD'
          else if (overallScore >= 55) grade = 'FAIR'

          return {
            staffId: staff.id,
            staffName: staff.name || '직원',
            rank: staff.rank || '-',
            categoryName: staff.categoryName || '미분류',
            totalShifts,
            nightShifts,
            weekendShifts,
            fairnessScore: overallScore,
            grade
          }
        } catch (error) {
          console.error(`   ⚠️ ${staff.name} 형평성 계산 실패:`, error)
          return {
            staffId: staff.id,
            staffName: staff.name || '직원',
            rank: staff.rank || '-',
            categoryName: staff.categoryName || '미분류',
            totalShifts: 0,
            nightShifts: 0,
            weekendShifts: 0,
            fairnessScore: 0,
            grade: 'POOR'
          }
        }
      })
    )

    console.log(`   ✅ 직원별 업무량 통계 조회 완료\n`)

    return NextResponse.json({
      success: true,
      data: workloadData
    })

  } catch (error) {
    console.error('Workload statistics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load workload statistics' },
      { status: 500 }
    )
  }
}
