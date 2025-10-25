/**
 * 출퇴근 기록 조회 API
 * GET: 출퇴근 이력 조회
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
    const staffId = searchParams.get('staffId')
    const suspicious = searchParams.get('suspicious')

    const where: any = {
      clinicId: session.user.clinicId
    }

    // 날짜 필터
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    // 직원 필터
    if (staffId && staffId !== 'all') {
      where.staffId = staffId
    }

    // 의심 패턴 필터
    if (suspicious === 'true') {
      where.isSuspicious = true
    } else if (suspicious === 'false') {
      where.isSuspicious = false
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        staff: {
          select: {
            name: true,
            rank: true
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { checkTime: 'desc' }
      ],
      take: 500 // 최대 500건
    })

    return successResponse(records)
  } catch (error) {
    console.error('Get attendance records error:', error)
    return errorResponse('Failed to fetch records', 500)
  }
}
