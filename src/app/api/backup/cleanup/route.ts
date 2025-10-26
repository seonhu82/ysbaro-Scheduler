/**
 * 오래된 백업 정리 API
 * POST /api/backup/cleanup
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { authOptions } from '@/lib/auth'
import { cleanupOldBackups } from '@/lib/services/assignment-backup-service'

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
    const { weekInfoId, keepCount } = body

    if (!weekInfoId) {
      return NextResponse.json(
        { success: false, error: 'weekInfoId가 필요합니다' },
        { status: 400 }
      )
    }

    const deletedCount = await cleanupOldBackups(weekInfoId, keepCount || 5)

    return NextResponse.json({
      success: true,
      message: `${deletedCount}개의 오래된 백업이 삭제되었습니다`,
      data: { deletedCount }
    })
  } catch (error: any) {
    console.error('백업 정리 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '백업 정리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
