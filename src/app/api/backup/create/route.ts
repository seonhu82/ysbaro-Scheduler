/**
 * 수동 백업 생성 API
 * POST /api/backup/create
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { authOptions } from '@/lib/auth'
import { createWeeklyAssignmentBackup } from '@/lib/services/assignment-backup-service'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { weekInfoId, description } = body

    if (!weekInfoId) {
      return NextResponse.json(
        { success: false, error: 'weekInfoId가 필요합니다' },
        { status: 400 }
      )
    }

    const backupId = await createWeeklyAssignmentBackup(
      weekInfoId,
      'MANUAL',
      description || `수동 백업 (${new Date().toLocaleString('ko-KR')})`,
      session.user.id
    )

    return NextResponse.json({
      success: true,
      message: '백업이 생성되었습니다',
      data: { backupId }
    })
  } catch (error: any) {
    console.error('백업 생성 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '백업 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
