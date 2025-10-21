// 연차 확정 API ⭐⭐

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // TODO: 트랜잭션으로 일괄 확정
    // 1. LeaveApplication 상태 변경
    // 2. Staff.annualLeaveUsed 증가
    // 3. 스케줄에서 직원 제거

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Confirm error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
