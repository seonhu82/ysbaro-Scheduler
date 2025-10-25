/**
 * 재배치 대기 목록 API
 * GET /api/leave-tracking/pending?clinicId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPendingReassignments } from '@/lib/services/leave-change-tracking-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')

    const pendingItems = await getPendingReassignments(clinicId || undefined)

    return NextResponse.json({
      success: true,
      data: pendingItems
    })
  } catch (error: any) {
    console.error('재배치 대기 목록 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '대기 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
