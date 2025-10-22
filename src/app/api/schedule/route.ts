// 스케줄 조회/생성

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month are required' },
        { status: 400 }
      )
    }

    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: parseInt(year),
        month: parseInt(month),
      },
      include: {
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                rank: true,
              },
            },
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: schedule,
    })
  } catch (error) {
    console.error('GET /api/schedule error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { year, month } = body

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month are required' },
        { status: 400 }
      )
    }

    // 기존 스케줄 확인
    const existing = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month,
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Schedule already exists for this period' },
        { status: 400 }
      )
    }

    // 새 스케줄 생성
    const schedule = await prisma.schedule.create({
      data: {
        clinicId,
        year,
        month,
        status: 'DRAFT',
      },
    })

    return NextResponse.json({
      success: true,
      data: schedule,
    })
  } catch (error) {
    console.error('POST /api/schedule error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
