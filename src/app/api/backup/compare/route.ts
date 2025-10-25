/**
 * 백업 비교 API
 * GET /api/backup/compare?weekInfoId=xxx&backupId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { compareWithBackup } from '@/lib/services/assignment-backup-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekInfoId = searchParams.get('weekInfoId')
    const backupId = searchParams.get('backupId')

    if (!weekInfoId || !backupId) {
      return NextResponse.json(
        { success: false, error: 'weekInfoId와 backupId가 필요합니다' },
        { status: 400 }
      )
    }

    const comparison = await compareWithBackup(weekInfoId, backupId)

    return NextResponse.json({
      success: true,
      data: comparison
    })
  } catch (error: any) {
    console.error('백업 비교 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '백업 비교 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
