/**
 * 백업 복구 API
 * POST /api/backup/restore
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { authOptions } from '@/lib/auth'
import { restoreWeeklyAssignmentFromBackup } from '@/lib/services/assignment-backup-service'

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
    const { backupId } = body

    if (!backupId) {
      return NextResponse.json(
        { success: false, error: 'backupId가 필요합니다' },
        { status: 400 }
      )
    }

    const result = await restoreWeeklyAssignmentFromBackup(
      backupId,
      session.user.id
    )

    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: {
        restoredCount: result.restoredCount
      }
    })
  } catch (error: any) {
    console.error('백업 복구 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '백업 복구 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
