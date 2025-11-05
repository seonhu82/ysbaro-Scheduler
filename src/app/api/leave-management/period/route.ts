import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

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

    // Fetch ApplicationLink with related data
    const applicationLinks = await prisma.applicationLink.findMany({
      where: {
        ...where,
        staffId: null // Only get links for all staff (not individual staff links)
      },
      include: {
        _count: {
          select: {
            applications: true
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // Fetch WeekInfo and DailySlot data to calculate actual slots
    const periods = await Promise.all(
      applicationLinks.map(async (link) => {
        // Get WeekInfo for this month
        const weekInfos = await prisma.weekInfo.findMany({
          where: {
            clinicId: session.user.clinicId,
            year: link.year,
            month: link.month
          },
          include: {
            dailySlots: {
              select: {
                date: true,
                availableSlots: true,
                requiredStaff: true
              }
            }
          }
        })

        // Calculate total slots from DailySlot data
        let totalSlots = 0
        weekInfos.forEach(weekInfo => {
          weekInfo.dailySlots.forEach(dailySlot => {
            totalSlots += dailySlot.availableSlots
          })
        })

        return {
          ...link,
          slotLimits: [{
            id: link.id,
            date: `${link.year}-${String(link.month).padStart(2, '0')}`,
            dayType: 'MONTH',
            maxSlots: totalSlots
          }]
        }
      })
    )

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

    // 병원별 공용 토큰 생성 또는 조회
    // 이미 존재하는 공용 토큰이 있으면 재사용, 없으면 새로 생성
    let sharedToken = await prisma.applicationLink.findFirst({
      where: {
        clinicId: session.user.clinicId,
        staffId: null, // 전체 직원용
        token: {
          not: null
        }
      },
      select: {
        token: true
      },
      orderBy: {
        createdAt: 'asc' // 가장 처음 생성된 토큰 사용
      }
    })

    // 공용 토큰이 없으면 새로 생성 (병원당 1회만)
    const token = sharedToken?.token ?? crypto.randomBytes(16).toString('hex')

    // Create ApplicationLink (신청 링크)
    const applicationLink = await prisma.applicationLink.create({
      data: {
        clinicId: session.user.clinicId,
        staffId: null, // Null means link is for all staff
        token, // 병원별 공용 토큰 사용
        year: parseInt(year),
        month: parseInt(month),
        expiresAt: new Date(endDate),
        status: 'ACTIVE'
      },
      include: {
        _count: {
          select: {
            applications: true
          }
        }
      }
    })

    // Also create LeavePeriod for tracking
    await prisma.leavePeriod.create({
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

    // Calculate total slots from existing WeekInfo/DailySlot data
    const weekInfos = await prisma.weekInfo.findMany({
      where: {
        clinicId: session.user.clinicId,
        year: parseInt(year),
        month: parseInt(month)
      },
      include: {
        dailySlots: {
          select: {
            availableSlots: true
          }
        }
      }
    })

    let totalSlots = 0
    weekInfos.forEach(weekInfo => {
      weekInfo.dailySlots.forEach(dailySlot => {
        totalSlots += dailySlot.availableSlots
      })
    })

    const responseData = {
      ...applicationLink,
      slotLimits: [{
        id: applicationLink.id,
        date: `${year}-${String(month).padStart(2, '0')}`,
        dayType: 'MONTH',
        maxSlots: totalSlots
      }]
    }

    return NextResponse.json({ success: true, data: responseData }, { status: 201 })
  } catch (error) {
    console.error('POST /api/leave-management/period error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create period' },
      { status: 500 }
    )
  }
}
