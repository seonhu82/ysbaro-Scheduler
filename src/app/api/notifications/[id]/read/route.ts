/**
 * 알림 읽음 처리 API
 * PATCH: 특정 알림을 읽음으로 표시
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '@/lib/utils/api-response'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    const { id } = params

    // 알림 조회 및 권한 확인
    const notification = await prisma.notification.findUnique({
      where: { id }
    })

    if (!notification) {
      return notFoundResponse('Notification not found')
    }

    if (notification.userId !== session.user.id) {
      return unauthorizedResponse()
    }

    // 읽음 처리
    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    })

    return successResponse(updatedNotification, 'Notification marked as read')
  } catch (error) {
    console.error('Mark notification as read error:', error)
    return errorResponse('Failed to mark notification as read', 500)
  }
}
