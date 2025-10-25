// 일별 배치
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { autoAssignSingleSlot } from '@/lib/algorithms/auto-assign'

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
    const date = searchParams.get('date')

    if (!date) {
      return NextResponse.json(
        { success: false, error: 'date parameter is required' },
        { status: 400 }
      )
    }

    // 해당 날짜의 배치 가능한 슬롯 목록 조회
    const { prisma } = await import('@/lib/prisma')
    const targetDate = new Date(date)

    const slots = await prisma.dailySlot.findMany({
      where: {
        week: { clinicId: session.user.clinicId },
        date: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lt: new Date(targetDate.setHours(23, 59, 59, 999))
        }
      },
      include: {
        week: true,
        staffAssignments: {
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
      }
    })

    return NextResponse.json({
      success: true,
      data: slots.map(slot => ({
        id: slot.id,
        date: slot.date,
        requiredStaff: slot.requiredStaff,
        assignedCount: slot.staffAssignments.length,
        isComplete: slot.staffAssignments.length >= slot.requiredStaff,
        assignments: slot.staffAssignments
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

    const { slotId } = await request.json()

    if (!slotId) {
      return NextResponse.json(
        { success: false, error: 'slotId is required' },
        { status: 400 }
      )
    }

    const result = await autoAssignSingleSlot(slotId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
