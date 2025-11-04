/**
 * 월별 추세 통계 API
 * GET /api/statistics/trend
 *
 * 최근 N개월의 통계 추세
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
    const months = parseInt(searchParams.get('months') || '6')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    console.log(`\n📊 월별 추세 통계 조회: ${year}년 ${month}월부터 ${months}개월`)

    const trendData = []

    // 최근 N개월 데이터 조회
    for (let i = months - 1; i >= 0; i--) {
      const targetDate = new Date(year, month - 1 - i, 1)
      const targetYear = targetDate.getFullYear()
      const targetMonth = targetDate.getMonth() + 1

      const schedule = await prisma.schedule.findFirst({
        where: {
          clinicId,
          year: targetYear,
          month: targetMonth,
          status: { in: ['DRAFT', 'DEPLOYED'] }
        }
      })

      if (!schedule) {
        trendData.push({
          month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
          totalSchedules: 0,
          fairnessScore: 0,
          nightShiftCount: 0,
          weekendShiftCount: 0
        })
        continue
      }

      // 배치 정보 조회
      const startDate = new Date(targetYear, targetMonth - 1, 1)
      const endDate = new Date(targetYear, targetMonth, 0)

      const staffAssignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      })

      const uniqueDates = new Set(staffAssignments.map(sa => sa.date.toISOString().split('T')[0]))
      const totalSchedules = uniqueDates.size

      const nightShiftCount = staffAssignments.filter(sa => sa.shiftType === 'NIGHT').length
      const weekendShiftCount = staffAssignments.filter(sa => {
        const dayOfWeek = sa.date.getDay()
        return dayOfWeek === 6
      }).length

      // 형평성 점수
      const fairnessScores = await prisma.fairnessScore.findMany({
        where: {
          year: targetYear,
          month: targetMonth,
          staff: {
            clinicId
          }
        }
      })

      let fairnessScore = 100
      if (fairnessScores.length > 0) {
        const nightCounts = fairnessScores.map(fs => fs.nightShiftCount)
        const avgNight = nightCounts.reduce((sum, n) => sum + n, 0) / nightCounts.length
        const nightVariance = nightCounts.reduce((sum, n) => sum + Math.pow(n - avgNight, 2), 0) / nightCounts.length
        const nightStdDev = Math.sqrt(nightVariance)
        fairnessScore = Math.max(0, Math.min(100, 100 - nightStdDev * 10))
      }

      trendData.push({
        month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
        totalSchedules,
        fairnessScore: Math.round(fairnessScore),
        nightShiftCount,
        weekendShiftCount
      })
    }

    console.log(`   ✅ ${trendData.length}개월 추세 데이터 조회 완료\n`)

    return NextResponse.json({
      success: true,
      data: trendData
    })

  } catch (error) {
    console.error('Trend statistics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load trend statistics' },
      { status: 500 }
    )
  }
}
