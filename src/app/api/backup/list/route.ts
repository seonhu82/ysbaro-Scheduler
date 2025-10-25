/**
 * 백업 목록 조회 API
 * GET /api/backup/list?weekInfoId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWeeklyBackups } from '@/lib/services/assignment-backup-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekInfoId = searchParams.get('weekInfoId')

    if (!weekInfoId) {
      return NextResponse.json(
        { success: false, error: 'weekInfoId가 필요합니다' },
        { status: 400 }
      )
    }

    const backups = await getWeeklyBackups(weekInfoId)

    return NextResponse.json({
      success: true,
      data: backups
    })
  } catch (error: any) {
    console.error('백업 목록 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '백업 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
