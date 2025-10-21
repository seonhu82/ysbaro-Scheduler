// 읽지 않은 알림 조회

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const unreadNotifications = await prisma.notification.findMany({
      where: {
        clinicId,
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const unreadCount = unreadNotifications.length

    return NextResponse.json({
      success: true,
      data: {
        notifications: unreadNotifications,
        count: unreadCount,
      },
    })
  } catch (error) {
    console.error('GET /api/notifications/unread error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
