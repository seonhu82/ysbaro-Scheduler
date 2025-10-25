/**
 * 재배치 실행 API
 * POST /api/leave-tracking/reassign
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { performAutoReassignment } from '@/lib/services/leave-change-tracking-service'

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
    const { changeLogId } = body

    if (!changeLogId) {
      return NextResponse.json(
        { success: false, error: 'changeLogId가 필요합니다' },
        { status: 400 }
      )
    }

    const result = await performAutoReassignment(changeLogId, session.user.id)

    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: result.results
    })
  } catch (error: any) {
    console.error('재배치 실행 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '재배치 실행 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
