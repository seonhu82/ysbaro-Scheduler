// 주간 배치
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createWeeklySchedule } from '@/lib/algorithms/weekly-assign'

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
    const startDate = searchParams.get('startDate')

    if (!startDate) {
      return NextResponse.json(
        { success: false, error: 'startDate parameter is required' },
        { status: 400 }
      )
    }

    // 해당 주의 스케줄 조회
    const { prisma } = await import('@/lib/prisma')
    const weekStart = new Date(startDate)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const weeks = await prisma.week.findMany({
      where: {
        clinicId: session.user.clinicId,
        startDate: {
          gte: weekStart,
          lte: weekEnd
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
      }
    })

    return NextResponse.json({
      success: true,
      data: weeks.map(week => ({
        id: week.id,
        startDate: week.startDate,
        endDate: week.endDate,
        year: week.year,
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
      }))
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

    const { startDate } = await request.json()

    if (!startDate) {
      return NextResponse.json(
        { success: false, error: 'startDate is required' },
        { status: 400 }
      )
    }

    const result = await createWeeklySchedule(
      session.user.clinicId,
      new Date(startDate)
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
