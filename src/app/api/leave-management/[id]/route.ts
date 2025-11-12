import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/leave-management/[id]
 * 연차/오프 신청 수정 (관리자만 가능)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const body = await request.json()
    const { leaveType, status } = body

    // 타입 검증
    if (leaveType && leaveType !== 'ANNUAL' && leaveType !== 'OFF') {
      return NextResponse.json(
        { success: false, error: 'Invalid leave type' },
        { status: 400 }
      )
    }

    // 상태 검증
    if (status && !['PENDING', 'CONFIRMED', 'CANCELLED', 'ON_HOLD', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    const clinicId = session.user.clinicId

    // 신청 조회 및 권한 확인
    const application = await prisma.leaveApplication.findUnique({
      where: { id: params.id },
      include: {
        staff: {
          select: {
            clinicId: true,
            name: true
          }
        }
      }
    })

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    if (application.staff.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Not your clinic' },
        { status: 403 }
      )
    }

    // 신청 수정
    const updated = await prisma.leaveApplication.update({
      where: { id: params.id },
      data: {
        ...(leaveType && { leaveType }),
        ...(status && { status })
      }
    })

    console.log(`✅ 연차/오프 수정: ${application.staff.name} - ${params.id}${status ? ` (상태: ${status})` : ''}`)

    return NextResponse.json({
      success: true,
      data: updated
    })

  } catch (error: any) {
    console.error('Update application error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update application' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/leave-management/[id]
 * 연차/오프 신청 삭제 (관리자만 가능)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // 신청 조회 및 권한 확인
    const application = await prisma.leaveApplication.findUnique({
      where: { id: params.id },
      include: {
        staff: {
          select: {
            clinicId: true,
            name: true
          }
        }
      }
    })

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    if (application.staff.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Not your clinic' },
        { status: 403 }
      )
    }

    // 신청 삭제
    await prisma.leaveApplication.delete({
      where: { id: params.id }
    })

    console.log(`✅ 연차/오프 삭제: ${application.staff.name} - ${params.id}`)

    return NextResponse.json({
      success: true,
      message: 'Application deleted successfully'
    })

  } catch (error: any) {
    console.error('Delete application error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete application' },
      { status: 500 }
    )
  }
}
