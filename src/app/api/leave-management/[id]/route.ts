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

    if (!status || !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(status)) {
      return badRequestResponse('Invalid status value')
    }

    // 신청 조회 및 권한 확인
    const application = await prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        staff: true
      }
    })

    if (!application) {
      return notFoundResponse('Application not found')
    }

    if (application.clinicId !== session.user.clinicId) {
      return unauthorizedResponse()
    }

    // 상태 업데이트
    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: { status }
    })

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
