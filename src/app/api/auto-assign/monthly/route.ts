// 월간 자동 배치 API ⭐⭐⭐

import { NextRequest, NextResponse } from 'next/server'
import { monthlyAssign } from '@/lib/algorithms/monthly-assign'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, month, mode, ratios } = body

    // TODO: 월간 배치 실행
    const result = await monthlyAssign({
      year,
      month,
      mode,
      ratios,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Monthly assign error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
