/**
 * 검증 실행 API
 * POST /api/validation/run
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateWeeklyAssignment } from '@/lib/services/assignment-validation-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { weekInfoId, autoFix } = body

    if (!weekInfoId) {
      return NextResponse.json(
        { success: false, error: 'weekInfoId가 필요합니다' },
        { status: 400 }
      )
    }

    const result = await validateWeeklyAssignment(
      weekInfoId,
      'PERIODIC_CHECK',
      autoFix || false
    )

    return NextResponse.json({
      success: true,
      message: `검증 완료: ${result.issues.length}건의 이슈 발견`,
      data: result
    })
  } catch (error: any) {
    console.error('검증 실행 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '검증 실행 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
