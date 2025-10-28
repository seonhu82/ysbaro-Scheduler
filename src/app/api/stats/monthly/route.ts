/**
 * 월간 통계 API
 *
 * GET /api/stats/monthly?clinicId=xxx&year=2024&month=6
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getMonthlyStats,
  getLeaveStats,
  getAttendanceStats
} from '@/lib/cache/stats-cache'
import { getCacheStats } from '@/lib/cache/redis-client'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const clinicId = searchParams.get('clinicId')
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!clinicId || !year || !month) {
      return NextResponse.json(
        { error: 'Missing required parameters: clinicId, year, month' },
        { status: 400 }
      )
    }

    if (year < 2020 || year > 2100 || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
    }

    // 병렬로 여러 통계 조회 (모두 캐싱됨)
    const [monthly, leave, attendance] = await Promise.all([
      getMonthlyStats(clinicId, year, month),
      getLeaveStats(clinicId, year, month),
      getAttendanceStats(clinicId, year, month)
    ])

    const cacheStats = getCacheStats()

    return NextResponse.json({
      success: true,
      data: {
        monthly,
        leave,
        attendance
      },
      meta: {
        cached: true,
        cacheHitRate: cacheStats.hitRate.toFixed(2) + '%'
      }
    })
  } catch (error) {
    console.error('Monthly stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monthly statistics' },
      { status: 500 }
    )
  }
}
