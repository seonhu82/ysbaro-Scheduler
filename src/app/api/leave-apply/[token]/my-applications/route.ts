/**
 * 직원용 신청 내역 조회 API
 * GET /api/leave-apply/[token]/my-applications?staffId={staffId}
 * POST /api/leave-apply/[token]/my-applications (deprecated, legacy PIN-based auth)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET: 인증된 세션에서 staffId로 신청 내역 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: 'staffId is required' },
        { status: 400 }
      )
    }

    // 1. Token 유효성 확인
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token }
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 404 }
      )
    }

    // 2. 직원 조회
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        clinicId: true
      }
    })

    if (!staff || staff.clinicId !== link.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      )
    }

    // 3. 해당 직원의 신청 내역 조회 (신청 기간 내의 신청만)
    const applications = await prisma.leaveApplication.findMany({
      where: {
        staffId: staff.id,
        date: {
          gte: link.startDate,
          lte: link.endDate
        }
      },
      orderBy: {
        date: 'asc'
      },
      select: {
        id: true,
        date: true,
        leaveType: true,
        status: true,
        holdReason: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      success: true,
      staffName: staff.name,
      applications: applications.map(app => ({
        ...app,
        date: app.date.toISOString().split('T')[0]
      }))
    })

  } catch (error) {
    console.error('My applications (GET) error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch applications' },
      { status: 500 }
    )
  }
}

/**
 * POST: Legacy PIN-based authentication (deprecated)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await request.json()
    const { pin } = body

    if (!pin || pin.length !== 4) {
      return NextResponse.json(
        { success: false, error: 'Invalid PIN' },
        { status: 400 }
      )
    }

    // 1. Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
      include: { staff: true }
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 404 }
      )
    }

    // 2. PIN으로 직원 조회
    let staff
    if (link.staffId) {
      // 특정 직원용 링크
      if (!link.staff) {
        return NextResponse.json(
          { success: false, error: 'Staff not found' },
          { status: 404 }
        )
      }
      if (link.staff.pin !== pin) {
        return NextResponse.json(
          { success: false, error: 'Invalid PIN' },
          { status: 401 }
        )
      }
      staff = link.staff
    } else {
      // 전체 직원용 링크
      staff = await prisma.staff.findFirst({
        where: {
          clinicId: link.clinicId,
          pin,
          isActive: true
        }
      })

      if (!staff) {
        return NextResponse.json(
          { success: false, error: 'Invalid PIN' },
          { status: 401 }
        )
      }
    }

    // 3. 해당 직원의 모든 신청 내역 조회
    const applications = await prisma.leaveApplication.findMany({
      where: {
        staffId: staff.id
      },
      orderBy: {
        date: 'desc'
      },
      select: {
        id: true,
        date: true,
        leaveType: true,
        status: true,
        holdReason: true,
        // rejectionReason: true, // 스키마 업데이트 후 활성화
        createdAt: true
      }
    })

    return NextResponse.json({
      success: true,
      staffName: staff.name,
      applications: applications.map(app => ({
        ...app,
        date: app.date.toISOString().split('T')[0]
      }))
    })

  } catch (error) {
    console.error('My applications error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch applications' },
      { status: 500 }
    )
  }
}
