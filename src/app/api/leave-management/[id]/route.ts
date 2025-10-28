import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  badRequestResponse
} from '@/lib/utils/api-response'
import { notifyLeaveApproved, notifyLeaveRejected } from '@/lib/services/notification-helper'
import { handleLeaveChange } from '@/lib/services/leave-change-tracking-service'

// PATCH: 신청 상태 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { id } = params
    const body = await request.json()
    const { status } = body

    if (!status || !['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return badRequestResponse('Invalid status value')
    }

    // 신청 조회 및 권한 확인
    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        staff: {
          include: {
            user: true
          }
        }
      }
    })

    if (!application) {
      return notFoundResponse('Application not found')
    }

    if (application.clinicId !== session.user.clinicId) {
      return unauthorizedResponse()
    }

    const oldStatus = application.status

    // 상태 업데이트
    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: { status }
    })

    // 🔔 알림 전송 (비동기)
    try {
      if (status === 'CONFIRMED' && application.staff.user) {
        await notifyLeaveApproved(
          application.staff.user.id,
          application.staff.name || '직원',
          application.date,
          application.leaveType
        )
      } else if (status === 'REJECTED' && application.staff.user) {
        await notifyLeaveRejected(
          application.staff.user.id,
          application.staff.name || '직원',
          application.date,
          application.leaveType
        )
      }
    } catch (notificationError) {
      console.error('알림 전송 실패 (무시):', notificationError)
    }

    // 🔄 재배치 트리거 (상태 변경 시)
    // CONFIRMED → REJECTED, CANCELLED 등 변경 시 재배치 필요
    if (oldStatus !== status && (oldStatus === 'CONFIRMED' || status === 'CONFIRMED')) {
      console.log(`🔄 연차 상태 변경 감지: ${oldStatus} → ${status}`)

      try {
        await handleLeaveChange({
          applicationId: id,
          staffId: application.staffId,
          date: application.date,
          oldStatus,
          newStatus: status,
          changedBy: session.user.id
        })
        console.log(`✅ 재배치 트리거 완료`)
      } catch (reassignError) {
        console.error('재배치 실패 (무시):', reassignError)
        // 재배치 실패는 무시 (수동 처리 가능)
      }
    }

    return successResponse(updated, `Status updated to ${status}`)
  } catch (error) {
    console.error('Update application error:', error)
    return errorResponse('Failed to update application', 500)
  }
}

// DELETE: 신청 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { id } = params

    // 신청 조회 및 권한 확인
    const application = await prisma.leaveApplication.findUnique({
      where: { id }
    })

    if (!application) {
      return notFoundResponse('Application not found')
    }

    if (application.clinicId !== session.user.clinicId) {
      return unauthorizedResponse()
    }

    // 삭제
    await prisma.leaveApplication.delete({
      where: { id }
    })

    return successResponse(null, 'Application deleted successfully')
  } catch (error) {
    console.error('Delete application error:', error)
    return errorResponse('Failed to delete application', 500)
  }
}
