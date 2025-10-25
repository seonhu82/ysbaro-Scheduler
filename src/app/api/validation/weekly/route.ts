/**
 * 주간 검증 API
 * GET /api/validation/weekly?weekInfoId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateWeeklyAssignment } from '@/lib/services/assignment-validation-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekInfoId = searchParams.get('weekInfoId')
    const autoFix = searchParams.get('autoFix') === 'true'

    if (!weekInfoId) {
      return NextResponse.json(
        { success: false, error: 'weekInfoId가 필요합니다' },
        { status: 400 }
      )
    }

    const result = await validateWeeklyAssignment(weekInfoId, 'PERIODIC_CHECK', autoFix)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('주간 검증 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '주간 검증 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
