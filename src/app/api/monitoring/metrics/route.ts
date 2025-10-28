/**
 * 성능 메트릭 API
 *
 * GET /api/monitoring/metrics - 전체 메트릭 조회
 * GET /api/monitoring/metrics?type=api - 특정 타입 메트릭 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { metricsCollector } from '@/lib/monitoring/metrics-collector'
import { getSystemHealth, getResourceUsage } from '@/lib/monitoring/performance-tracker'
import { withErrorHandling } from '@/lib/error-tracking/with-error-handling'

async function handleGET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') // 'api', 'cache', 'database', etc.
  const path = searchParams.get('path') // 특정 API 경로

  try {
    // 1. API 통계
    const apiStats = await metricsCollector.getAPIStats(path || undefined)

    // 2. 느린 요청
    const slowRequests = await metricsCollector.getSlowRequests(10)

    // 3. 캐시 통계
    const cacheStats = await metricsCollector.getCacheStats()

    // 4. 시스템 상태
    const systemHealth = await getSystemHealth()

    // 5. 리소스 사용량
    const resourceUsage = getResourceUsage()

    // 타입별 필터링
    if (type === 'api') {
      return NextResponse.json({
        success: true,
        data: {
          api: apiStats,
          slowRequests
        }
      })
    }

    if (type === 'cache') {
      return NextResponse.json({
        success: true,
        data: { cache: cacheStats }
      })
    }

    if (type === 'system') {
      return NextResponse.json({
        success: true,
        data: {
          health: systemHealth,
          resources: resourceUsage
        }
      })
    }

    // 전체 메트릭
    return NextResponse.json({
      success: true,
      data: {
        api: apiStats,
        slowRequests,
        cache: cacheStats,
        system: {
          health: systemHealth,
          resources: resourceUsage
        },
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Failed to fetch metrics:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics'
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorHandling(handleGET)
