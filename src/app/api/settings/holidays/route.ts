/**
 * 휴업일 관리 API
 * GET: 휴업일 목록 조회
 * POST: 새 휴업일 추가
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
    const year = searchParams.get('year')

    const where: any = {
      clinicId: session.user.clinicId
    }

    // 연도 필터
    if (year) {
      const startDate = new Date(parseInt(year), 0, 1)
      const endDate = new Date(parseInt(year), 11, 31)
      where.date = {
        gte: startDate,
        lte: endDate
      }
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: {
        date: 'asc'
      }
    })

    return successResponse(holidays)
  } catch (error) {
    console.error('Get holidays error:', error)
    return errorResponse('Failed to fetch holidays', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { date, name } = body

    if (!date || !name) {
      return badRequestResponse('Date and name are required')
    }

    // 날짜 파싱
    const holidayDate = new Date(date)

    // 이미 존재하는지 확인
    const existing = await prisma.holiday.findUnique({
      where: {
        clinicId_date: {
          clinicId: session.user.clinicId,
          date: holidayDate
        }
      }
    })

    if (existing) {
      return badRequestResponse('Holiday already exists for this date')
    }

    // 휴업일 생성
    const holiday = await prisma.holiday.create({
      data: {
        clinicId: session.user.clinicId,
        date: holidayDate,
        name
      }
    })

    return successResponse(holiday, 'Holiday created successfully')
  } catch (error) {
    console.error('Create holiday error:', error)
    return errorResponse('Failed to create holiday', 500)
  }
}
