/**
 * 공휴일 자동 불러오기 API
 * POST: 지정된 연도의 한국 공휴일을 자동으로 추가
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

// 한국 공휴일 데이터 (2024-2026)
const KOREAN_HOLIDAYS: Record<number, Array<{ date: string; name: string }>> = {
  2024: [
    { date: '2024-01-01', name: '신정' },
    { date: '2024-02-09', name: '설날 전날' },
    { date: '2024-02-10', name: '설날' },
    { date: '2024-02-11', name: '설날 연휴' },
    { date: '2024-02-12', name: '대체공휴일(설날)' },
    { date: '2024-03-01', name: '삼일절' },
    { date: '2024-04-10', name: '국회의원 선거일' },
    { date: '2024-05-05', name: '어린이날' },
    { date: '2024-05-06', name: '대체공휴일(어린이날)' },
    { date: '2024-05-15', name: '부처님오신날' },
    { date: '2024-06-06', name: '현충일' },
    { date: '2024-08-15', name: '광복절' },
    { date: '2024-09-16', name: '추석 연휴' },
    { date: '2024-09-17', name: '추석' },
    { date: '2024-09-18', name: '추석 연휴' },
    { date: '2024-10-03', name: '개천절' },
    { date: '2024-10-09', name: '한글날' },
    { date: '2024-12-25', name: '크리스마스' }
  ],
  2025: [
    { date: '2025-01-01', name: '신정' },
    { date: '2025-01-28', name: '설날 연휴' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 연휴' },
    { date: '2025-03-01', name: '삼일절' },
    { date: '2025-03-03', name: '대체공휴일(삼일절)' },
    { date: '2025-05-05', name: '어린이날' },
    { date: '2025-05-06', name: '부처님오신날' },
    { date: '2025-06-06', name: '현충일' },
    { date: '2025-08-15', name: '광복절' },
    { date: '2025-10-05', name: '추석 연휴' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 연휴' },
    { date: '2025-10-08', name: '대체공휴일(추석)' },
    { date: '2025-10-03', name: '개천절' },
    { date: '2025-10-09', name: '한글날' },
    { date: '2025-12-25', name: '크리스마스' }
  ],
  2026: [
    { date: '2026-01-01', name: '신정' },
    { date: '2026-02-16', name: '설날 연휴' },
    { date: '2026-02-17', name: '설날' },
    { date: '2026-02-18', name: '설날 연휴' },
    { date: '2026-03-01', name: '삼일절' },
    { date: '2026-05-05', name: '어린이날' },
    { date: '2026-05-25', name: '부처님오신날' },
    { date: '2026-06-06', name: '현충일' },
    { date: '2026-08-15', name: '광복절' },
    { date: '2026-09-24', name: '추석 연휴' },
    { date: '2026-09-25', name: '추석' },
    { date: '2026-09-26', name: '추석 연휴' },
    { date: '2026-10-03', name: '개천절' },
    { date: '2026-10-09', name: '한글날' },
    { date: '2026-12-25', name: '크리스마스' }
  ]
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { year } = body

    if (!year) {
      return NextResponse.json(
        { success: false, error: 'Year is required' },
        { status: 400 }
      )
    }

    const holidays = KOREAN_HOLIDAYS[year as number]

    if (!holidays) {
      return NextResponse.json(
        { success: false, error: `${year}년도의 공휴일 데이터가 없습니다. (지원: 2024-2026)` },
        { status: 400 }
      )
    }

    // 기존 공휴일 조회
    const existingHolidays = await prisma.holiday.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        }
      }
    })

    const existingDates = new Set(
      existingHolidays.map(h => h.date.toISOString().split('T')[0])
    )

    // 중복되지 않는 공휴일만 추가
    const newHolidays = holidays.filter(h => !existingDates.has(h.date))

    if (newHolidays.length === 0) {
      return successResponse(
        { count: 0 },
        '이미 모든 공휴일이 등록되어 있습니다'
      )
    }

    // 공휴일 추가
    await prisma.holiday.createMany({
      data: newHolidays.map(h => ({
        clinicId: session.user.clinicId,
        date: new Date(h.date),
        name: h.name
      }))
    })

    return successResponse(
      { count: newHolidays.length },
      `${newHolidays.length}개의 공휴일이 추가되었습니다`
    )
  } catch (error) {
    console.error('Import holidays error:', error)
    return errorResponse('Failed to import holidays', 500)
  }
}
