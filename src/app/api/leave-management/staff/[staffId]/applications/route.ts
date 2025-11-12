import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/leave-management/staff/[staffId]/applications
 * 특정 직원의 모든 연차/오프 신청 내역 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
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

    const clinicId = session.user.clinicId
    const { staffId } = params

    // 직원이 해당 클리닉 소속인지 확인
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { clinicId: true, name: true }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      )
    }

    if (staff.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Not your clinic' },
        { status: 403 }
      )
    }

    // 해당 직원의 모든 신청 내역 조회
    const applications = await prisma.leaveApplication.findMany({
      where: {
        staffId,
      },
      select: {
        id: true,
        date: true,
        leaveType: true,
        status: true,
        link: {
          select: {
            year: true,
            month: true,
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    })

    // 데이터 변환
    const formattedApplications = applications.map(app => ({
      id: app.id,
      date: app.date.toISOString(),
      leaveType: app.leaveType,
      status: app.status,
      year: app.link.year,
      month: app.link.month,
    }))

    return NextResponse.json({
      success: true,
      data: formattedApplications
    })

  } catch (error: any) {
    console.error('Get staff applications error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch applications' },
      { status: 500 }
    )
  }
}
