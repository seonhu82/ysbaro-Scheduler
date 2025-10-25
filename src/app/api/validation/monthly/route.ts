/**
 * 월간 검증 API
 * GET /api/validation/monthly?clinicId=xxx&year=2025&month=10
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAllWeeksInMonth } from '@/lib/services/assignment-validation-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!clinicId || !year || !month) {
      return NextResponse.json(
        { success: false, error: 'clinicId, year, month가 필요합니다' },
        { status: 400 }
      )
    }

    const result = await validateAllWeeksInMonth(
      clinicId,
      parseInt(year),
      parseInt(month)
    )

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('월간 검증 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '월간 검증 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
