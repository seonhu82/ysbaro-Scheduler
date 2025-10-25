// 월간 자동 배치 API ⭐⭐⭐

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { monthlyAssign } from '@/lib/algorithms/monthly-assign'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'year and month parameters are required' },
        { status: 400 }
      )
    }

    // 해당 월의 모든 주 스케줄 조회
    const { prisma } = await import('@/lib/prisma')
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(month), 0)

    const weeks = await prisma.week.findMany({
      where: {
        clinicId: session.user.clinicId,
        year: parseInt(year),
        startDate: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        dailySlots: {
          include: {
            assignments: {
              include: {
                staff: {
                  select: {
                    id: true,
                    name: true,
                    rank: true
                  }
                }
              }
            }
          },
          orderBy: { date: 'asc' }
        }
      },
      orderBy: { weekNumber: 'asc' }
    })

    // 월간 통계 계산
    const totalSlots = weeks.reduce(
      (sum, week) => sum + week.dailySlots.length,
      0
    )
    const totalAssignments = weeks.reduce(
      (sum, week) =>
        sum +
        week.dailySlots.reduce((s, slot) => s + slot.assignments.length, 0),
      0
    )
    const totalRequired = weeks.reduce(
      (sum, week) =>
        sum + week.dailySlots.reduce((s, slot) => s + slot.requiredStaff, 0),
      0
    )

    return NextResponse.json({
      success: true,
      data: {
        year: parseInt(year),
        month: parseInt(month),
        weeks: weeks.map(week => ({
          id: week.id,
          startDate: week.startDate,
          endDate: week.endDate,
          weekNumber: week.weekNumber,
          isConfirmed: week.isConfirmed,
          dailySlots: week.dailySlots.map(slot => ({
            id: slot.id,
            date: slot.date,
            requiredStaff: slot.requiredStaff,
            assignedCount: slot.assignments.length,
            isComplete: slot.assignments.length >= slot.requiredStaff,
            assignments: slot.assignments
          }))
        })),
        summary: {
          totalSlots,
          totalAssignments,
          totalRequired,
          completionRate:
            totalRequired > 0
              ? Math.round((totalAssignments / totalRequired) * 100)
              : 0
        }
      }
    })
  } catch (error) {
    console.error('GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { year, month, mode, ratios } = body

    const result = await monthlyAssign({
      clinicId: session.user.clinicId,
      year,
      month,
      mode,
      ratios
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Monthly assign error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
