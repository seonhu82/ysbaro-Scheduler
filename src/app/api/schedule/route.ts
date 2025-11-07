// 스케줄 조회/생성

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

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

    // 메인 캘린더용: DEPLOYED 스케줄만 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: parseInt(year),
        month: parseInt(month),
        status: 'DEPLOYED', // 배포된 스케줄만 조회
      },
      include: {
        doctors: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                shortName: true,
              },
            },
          },
          orderBy: {
            date: 'asc',
          },
        },
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

    // 해당 월의 승인된 휴가 정보 조회 (schedule이 있을 때만)
    let leaves: any[] = []
    let holidays: any[] = []
    if (schedule) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0)

      leaves = await prisma.leaveApplication.findMany({
        where: {
          clinicId,
          date: {
            gte: startDate,
            lte: endDate,
          },
          status: 'CONFIRMED',
        },
      })

      // 공휴일 조회
      holidays = await prisma.holiday.findMany({
        where: {
          clinicId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          date: true,
          name: true,
        },
      })

      console.log(`📅 /api/schedule: ${year}년 ${month}월 공휴일 ${holidays.length}개 조회`)
    }

    return NextResponse.json({
      success: true,
      data: schedule ? {
        ...schedule,
        leaves,
        holidays,
      } : null,
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
    const session = await auth()

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
