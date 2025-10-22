// 목록뷰 데이터 - 연차 신청 내역 조회

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
    const status = searchParams.get('status') // PENDING, CONFIRMED, CANCELLED
    const linkId = searchParams.get('linkId') // 특정 신청 기간 필터
    const month = searchParams.get('month') // YYYY-MM 형식

    // 필터 조건 구성
    const where: any = {
      clinicId,
    }

    if (status && ['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
      where.status = status
    }

    if (linkId) {
      where.linkId = linkId
    }

    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      const startDate = new Date(year, monthNum - 1, 1)
      const endDate = new Date(year, monthNum, 0, 23, 59, 59)

      where.date = {
        gte: startDate,
        lte: endDate,
      }
    }

    // 데이터 조회
    const applications = await prisma.leaveApplication.findMany({
      where,
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
      orderBy: [
        { date: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: applications,
    })
  } catch (error) {
    console.error('GET /api/leave-management/list-view error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
