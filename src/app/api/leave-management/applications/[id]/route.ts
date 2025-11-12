import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

/**
 * PATCH /api/leave-management/applications/[id]
 * 신청 상태 변경 (드래그 앤 드롭)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { status, holdReason } = body

    // 유효성 검사
    const validStatuses = ['PENDING', 'CONFIRMED', 'ON_HOLD', 'REJECTED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    // 기존 신청 확인
    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        staff: true,
        link: true
      }
    })

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    if (application.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      )
    }

    // 상태 업데이트
    const updateData: any = {
      status
    }

    // ON_HOLD 상태로 변경 시 보류 사유 필요
    if (status === 'ON_HOLD') {
      updateData.holdReason = holdReason || '관리자가 보류 처리함'
    } else {
      updateData.holdReason = null
    }

    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: updateData
    })

    return successResponse(updated, 'Status updated successfully')
  } catch (error) {
    console.error('Update application status error:', error)
    return errorResponse('Failed to update status', 500)
  }
}
