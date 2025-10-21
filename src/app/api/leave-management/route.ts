// 연차 신청 목록 조회

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const staffId = searchParams.get('staffId')

    const where: any = { clinicId }
    if (status) where.status = status
    if (staffId) where.staffId = staffId

    // 날짜 필터
    if (year && month) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
      const endDate = new Date(parseInt(year), parseInt(month), 0)

      where.date = {
        gte: startDate,
        lte: endDate,
      }
    }

    const applications = await prisma.leaveApplication.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
          },
        },
        link: {
          select: {
            year: true,
            month: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      success: true,
      data: applications,
    })
  } catch (error) {
    console.error('GET /api/leave-management error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
