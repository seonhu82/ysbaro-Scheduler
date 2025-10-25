/**
 * 모든 알림 읽음 처리 API
 * PATCH: 사용자의 모든 알림을 읽음으로 표시
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    // 모든 읽지 않은 알림을 읽음 처리
    const result = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        isRead: false
      },
      data: {
        isRead: true
      }
    })

    return successResponse(
      { count: result.count },
      `${result.count} notifications marked as read`
    )
  } catch (error) {
    console.error('Mark all notifications as read error:', error)
    return errorResponse('Failed to mark all notifications as read', 500)
  }
}
