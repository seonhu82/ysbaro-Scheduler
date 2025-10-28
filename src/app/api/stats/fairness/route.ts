/**
 * 형평성 통계 API
 *
 * GET /api/stats/fairness?clinicId=xxx&year=2024&month=6
 */

import { NextRequest, NextResponse } from 'next/server'
import { getComprehensiveFairnessStats } from '@/lib/cache/fairness-cache'
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

    // 캐싱된 통계 조회
    const stats = await getComprehensiveFairnessStats(clinicId, year, month)

    // 캐시 히트율 추가 (디버깅용)
    const cacheStats = getCacheStats()

    return NextResponse.json({
      success: true,
      data: stats,
      meta: {
        cached: true,
        cacheHitRate: cacheStats.hitRate.toFixed(2) + '%'
      }
    })
  } catch (error) {
    console.error('Fairness stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fairness statistics' },
      { status: 500 }
    )
  }
}
