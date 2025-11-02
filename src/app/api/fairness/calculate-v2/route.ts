/**
 * 형평성 점수 계산 API V2
 * GET /api/fairness/calculate-v2
 *
 * Query params:
 * - staffId: 직원 ID
 * - year: 연도
 * - month: 월
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

    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!staffId || !year || !month) {
      return NextResponse.json(
        { success: false, error: 'staffId, year, and month are required' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    // 직원 정보 조회
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    })

    if (!staff || staff.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      )
    }

    // 형평성 점수 계산
    const fairnessScore = await calculateStaffFairnessV2(staffId, clinicId, year, month)

    // 카테고리 평균 계산
    const categoryStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        categoryName: staff.categoryName,
        isActive: true
      }
    })

    const categoryScores = await Promise.all(
      categoryStaff.map(s => calculateStaffFairnessV2(s.id, clinicId, year, month))
    )

    const categoryAverage = Math.round(
      categoryScores.reduce((sum, s) => sum + s.overallScore, 0) / categoryScores.length
    )

    // 순위 계산 (낮은 점수부터)
    const sortedScores = categoryScores
      .map((score, index) => ({ score: score.overallScore, staffId: categoryStaff[index].id }))
      .sort((a, b) => a.score - b.score)

    const rank = sortedScores.findIndex(s => s.staffId === staffId) + 1

    return NextResponse.json({
      success: true,
      fairness: {
        ...fairnessScore,
        categoryName: staff.categoryName,
        categoryAverage,
        rank,
        totalInCategory: categoryStaff.length
      }
    })

  } catch (error) {
    console.error('Fairness calculation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to calculate fairness' },
      { status: 500 }
    )
  }
}
