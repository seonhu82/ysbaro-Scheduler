// 연차/오프 신청 API ⭐⭐⭐ 중요!

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await request.json()
    const { staffId, leaveDate, leaveType, tempToken } = body

    // TODO: 1. 임시 토큰 검증
    // TODO: 2. 신청 링크 확인
    // TODO: 3. 날짜 유효성
    // TODO: 4. ⭐ 휴일 체크 (일요일 또는 공휴일)
    // TODO: 5. ⭐ 주간 오프 제한 (주 2일)
    // TODO: 6. 슬롯 제한 확인
    // TODO: 7. 중복 신청 확인
    // TODO: 8. 트랜잭션으로 생성
    // TODO: 9. 알림 생성

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Leave application error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
