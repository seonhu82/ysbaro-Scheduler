// 달력뷰 데이터 - 월별 연차 신청 현황

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

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

    // URL 쿼리 파라미터
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month are required' },
        { status: 400 }
      )
    }

    const yearNum = parseInt(year)
    const monthNum = parseInt(month)

    // 해당 월의 시작일과 종료일
    const startDate = new Date(yearNum, monthNum - 1, 1)
    const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59)

    // 연차 신청 조회
    const applications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            email: true,
          },
        },
        link: {
          select: {
            id: true,
            year: true,
            month: true,
            token: true,
            status: true,
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    })

    // 날짜별로 그룹화
    const groupedByDate: Record<
      string,
      Array<{
        id: string
        leaveType: string
        status: string
        staff: {
          id: string
          name: string
          rank: string
          email: string | null
        }
        link: {
          id: string
          year: number
          month: number
          token: string
          status: string
        }
      }>
    > = {}

    applications.forEach((app) => {
      const dateKey = app.date.toISOString().split('T')[0] // YYYY-MM-DD
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = []
      }
      groupedByDate[dateKey].push({
        id: app.id,
        leaveType: app.leaveType,
        status: app.status,
        staff: app.staff,
        link: app.link,
      })
    })

    return NextResponse.json({
      success: true,
      data: groupedByDate,
    })
  } catch (error) {
    console.error('GET /api/leave-management/calendar-view error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
