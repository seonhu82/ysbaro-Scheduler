// 슬롯 현황 조회 API

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    // TODO: 슬롯 현황 조회
    // - 날짜별 슬롯 상태
    // - ⭐ 휴일 정보 포함
    // - 주간 오프 개수
    // - 직원 연차 정보

    return NextResponse.json({ success: true, data: {} })
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
