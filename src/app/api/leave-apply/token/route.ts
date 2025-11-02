/**
 * 연차/오프 신청 토큰 조회 API
 * GET /api/leave-apply/token
 *
 * 클리닉의 연차 신청 토큰을 반환합니다.
 * 토큰은 clinicId를 기반으로 생성된 고정값입니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    // 클리닉 ID를 기반으로 토큰 생성 (고정값)
    // 실제 운영에서는 데이터베이스에 저장하거나 더 복잡한 로직 사용
    const token = crypto
      .createHash('sha256')
      .update(`${clinicId}-leave-apply-token`)
      .digest('hex')
      .substring(0, 32)

    return NextResponse.json({
      success: true,
      token,
      clinicId
    })
  } catch (error) {
    console.error('Leave apply token error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get leave apply token' },
      { status: 500 }
    )
  }
}
