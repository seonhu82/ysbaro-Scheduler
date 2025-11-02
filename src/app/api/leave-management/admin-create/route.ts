import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/leave-management/admin-create
 * 관리자가 직접 연차/오프 생성
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

    // ADMIN 또는 MANAGER 권한 확인
    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin or Manager role required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { staffId, date, leaveType } = body

    // 필수 필드 검증
    if (!staffId || !date || !leaveType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 타입 검증
    if (leaveType !== 'ANNUAL' && leaveType !== 'OFF') {
      return NextResponse.json(
        { success: false, error: 'Invalid leave type' },
        { status: 400 }
      )
    }

    const clinicId = session.user.clinicId
    const applicationDate = new Date(date)

    // 직원 확인
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    })

    if (!staff || staff.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Staff not found or not in your clinic' },
        { status: 404 }
      )
    }

    // 중복 신청 확인
    const existing = await prisma.leaveApplication.findFirst({
      where: {
        staffId,
        date: applicationDate,
        status: { not: 'REJECTED' }
      }
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: '해당 날짜에 이미 연차/오프가 등록되어 있습니다.' },
        { status: 409 }
      )
    }

    // 관리자용 임시 ApplicationLink 찾기 또는 생성
    // 관리자가 수동 생성하는 경우를 위한 특수 링크
    const year = applicationDate.getFullYear()
    const month = applicationDate.getMonth() + 1

    let adminLink = await prisma.applicationLink.findFirst({
      where: {
        clinicId,
        year,
        month,
        staffId: null, // 전체 직원용
        token: { startsWith: 'ADMIN_' }
      }
    })

    if (!adminLink) {
      // 관리자용 특수 링크 생성
      adminLink = await prisma.applicationLink.create({
        data: {
          clinicId,
          year,
          month,
          token: `ADMIN_${clinicId}_${year}_${month}`,
          expiresAt: new Date(year, month, 0), // 해당 월 마지막 날
          status: 'ACTIVE'
        }
      })
    }

    // 연차/오프 생성 (관리자가 생성한 것은 자동 CONFIRMED)
    const application = await prisma.leaveApplication.create({
      data: {
        clinicId,
        staffId,
        linkId: adminLink.id,
        date: applicationDate,
        leaveType,
        status: 'CONFIRMED', // 관리자가 생성하면 즉시 승인
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            categoryName: true
          }
        }
      }
    })

    console.log(`✅ 관리자 수동 연차/오프 생성: ${staff.name} (${applicationDate.toISOString().split('T')[0]}) - ${leaveType}`)

    return NextResponse.json({
      success: true,
      data: application
    }, { status: 201 })

  } catch (error: any) {
    console.error('Admin leave creation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create leave application' },
      { status: 500 }
    )
  }
}
