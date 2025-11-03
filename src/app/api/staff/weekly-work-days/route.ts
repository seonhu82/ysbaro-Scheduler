/**
 * 직원의 주간 근무일 수 조회 API
 * GET: 특정 직원의 해당 주(일~토) 근무일 수 반환
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const dateParam = searchParams.get('date')

    if (!staffId || !dateParam) {
      return badRequestResponse('staffId and date are required')
    }

    const dateOnly = new Date(dateParam + 'T00:00:00.000Z')

    // 해당 주의 시작일(일요일)과 종료일(토요일) 계산
    const weekStart = new Date(dateOnly)
    weekStart.setDate(dateOnly.getDate() - dateOnly.getDay()) // 일요일로
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // 토요일까지

    // 해당 직원의 주간 근무일 수
    const weeklyWorkDays = await prisma.staffAssignment.count({
      where: {
        staffId,
        date: {
          gte: weekStart,
          lte: weekEnd
        },
        shiftType: {
          in: ['DAY', 'NIGHT']
        }
      }
    })

    return successResponse({
      weeklyWorkDays,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      limit: 4
    })

  } catch (error) {
    console.error('Get weekly work days error:', error)
    return errorResponse('Failed to get weekly work days', 500)
  }
}
