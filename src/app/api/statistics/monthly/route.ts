/**
 * 월간 통계 요약 API
 * GET /api/statistics/monthly
 *
 * 특정 월의 전체 통계 요약
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

    console.log(`\n📊 월간 통계 요약 조회: ${year}년 ${month}월`)

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
        data: {
          totalSchedules: 0,
          totalAssignments: 0,
          avgStaffPerDay: 0,
          fairnessScore: 0,
          nightShiftCount: 0,
          weekendShiftCount: 0,
          byRank: {}
        }
      })
    }

    // 배치 정보 조회
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    const staffAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        staff: {
          select: {
            rank: true
          }
        }
      }
    })

    const totalAssignments = staffAssignments.length

    // 고유 날짜 수
    const uniqueDates = new Set(staffAssignments.map(sa => sa.date.toISOString().split('T')[0]))
    const totalSchedules = uniqueDates.size

    // 일평균 배치 인원
    const avgStaffPerDay = totalSchedules > 0 ? totalAssignments / totalSchedules : 0

    // 야간/주말 카운트 (간단한 집계)
    const nightShiftCount = staffAssignments.filter(sa => sa.shiftType === 'NIGHT').length
    const weekendShiftCount = staffAssignments.filter(sa => {
      const dayOfWeek = sa.date.getDay()
      return dayOfWeek === 6 // 토요일만
    }).length

    // 직급별 통계
    const byRank: Record<string, { count: number; percentage: number }> = {}
    staffAssignments.forEach(sa => {
      const rank = sa.staff.rank || '미분류'
      if (!byRank[rank]) {
        byRank[rank] = { count: 0, percentage: 0 }
      }
      byRank[rank].count++
    })

    // 퍼센트 계산
    Object.keys(byRank).forEach(rank => {
      byRank[rank].percentage = totalAssignments > 0
        ? Math.round((byRank[rank].count / totalAssignments) * 100)
        : 0
    })

    // 형평성 점수 (FairnessScore 테이블에서 평균 계산)
    const fairnessScores = await prisma.fairnessScore.findMany({
      where: {
        year,
        month,
        staff: {
          clinicId
        }
      }
    })

    // 간단한 형평성 점수 (야간+주말 카운트의 표준편차 기반)
    let fairnessScore = 100
    if (fairnessScores.length > 0) {
      const nightCounts = fairnessScores.map(fs => fs.nightShiftCount)
      const avgNight = nightCounts.reduce((sum, n) => sum + n, 0) / nightCounts.length
      const nightVariance = nightCounts.reduce((sum, n) => sum + Math.pow(n - avgNight, 2), 0) / nightCounts.length
      const nightStdDev = Math.sqrt(nightVariance)

      // 표준편차가 작을수록 형평성이 좋음 (100점 만점)
      fairnessScore = Math.max(0, Math.min(100, 100 - nightStdDev * 10))
    }

    console.log(`   ✅ 월간 통계 조회 완료\n`)

    return NextResponse.json({
      success: true,
      data: {
        totalSchedules,
        totalAssignments,
        avgStaffPerDay: Math.round(avgStaffPerDay * 10) / 10,
        fairnessScore: Math.round(fairnessScore),
        nightShiftCount,
        weekendShiftCount,
        byRank
      }
    })

  } catch (error) {
    console.error('Monthly statistics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load monthly statistics' },
      { status: 500 }
    )
  }
}
