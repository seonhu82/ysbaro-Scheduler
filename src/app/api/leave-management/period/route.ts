import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/leave-management/period
 * 신청 기간 목록 조회
 */
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

    const where: any = {
      clinicId: session.user.clinicId
    }

    if (year) {
      where.year = parseInt(year)
    }
    if (month) {
      where.month = parseInt(month)
    }

    const periods = await prisma.leavePeriod.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({ success: true, data: periods })
  } catch (error) {
    console.error('GET /api/leave-management/period error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch periods' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/leave-management/period
 * 신청 기간 생성
 */
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
    const { year, month, startDate, endDate, maxSlots, categorySlots } = body

    // 필수 필드 검증
    if (!year || !month || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 날짜 유효성 검증
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      return NextResponse.json(
        { success: false, error: 'Start date must be before end date' },
        { status: 400 }
      )
    }

    // 중복 체크
    const existing = await prisma.leavePeriod.findUnique({
      where: {
        clinicId_year_month: {
          clinicId: session.user.clinicId,
          year: parseInt(year),
          month: parseInt(month)
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Period already exists for this year and month' },
        { status: 409 }
      )
    }

    // 신청 기간 생성
    const period = await prisma.leavePeriod.create({
      data: {
        clinicId: session.user.clinicId,
        year: parseInt(year),
        month: parseInt(month),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        maxSlots: maxSlots ? parseInt(maxSlots) : 0,
        categorySlots: categorySlots || null,
        isActive: true
      }
    })

    return NextResponse.json({ success: true, data: period }, { status: 201 })
  } catch (error) {
    console.error('POST /api/leave-management/period error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create period' },
      { status: 500 }
    )
  }
}
