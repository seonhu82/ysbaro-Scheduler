/**
 * 개별 휴업일 관리 API
 * DELETE: 휴업일 삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/api-response'

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

    // 휴업일 조회 및 권한 확인
    const holiday = await prisma.holiday.findUnique({
      where: { id }
    })

    if (!holiday) {
      return notFoundResponse('Holiday not found')
    }

    if (holiday.clinicId !== session.user.clinicId) {
      return unauthorizedResponse()
    }

    // 삭제
    await prisma.holiday.delete({
      where: { id }
    })

    return successResponse(null, 'Holiday deleted successfully')
  } catch (error) {
    console.error('Delete holiday error:', error)
    return errorResponse('Failed to delete holiday', 500)
  }
}
