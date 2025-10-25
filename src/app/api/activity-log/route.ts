/**
 * 활동 로그 조회 API
 * GET: 활동 로그 이력 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const activityType = searchParams.get('activityType')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {
      clinicId: session.user.clinicId
    }

    // 날짜 필터
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // 활동 유형 필터
    if (activityType && activityType !== 'all') {
      where.activityType = activityType
    }

    // 사용자 필터
    if (userId && userId !== 'all') {
      where.userId = userId
    }

    const logs = await prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    // 총 개수 조회
    const totalCount = await prisma.activityLog.count({ where })

    return successResponse({
      logs,
      totalCount,
      hasMore: totalCount > limit
    })
  } catch (error) {
    console.error('Get activity logs error:', error)
    return errorResponse('Failed to fetch activity logs', 500)
  }
}
