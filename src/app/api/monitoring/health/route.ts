/**
 * 시스템 상태 체크 API
 *
 * GET /api/monitoring/health - 시스템 상태 확인
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSystemHealth, getResourceUsage } from '@/lib/monitoring/performance-tracker'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    // 시스템 상태 체크
    const health = await getSystemHealth()
    const resources = getResourceUsage()

    // 데이터베이스 상세 정보
    let dbInfo = null
    if (health.checks.database) {
      try {
        // 활성 연결 수 확인 (PostgreSQL)
        const connections = await prisma.$queryRaw<any[]>`
          SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'
        `
        dbInfo = {
          activeConnections: connections[0]?.count || 0
        }
      } catch {
        dbInfo = { activeConnections: 'unknown' }
      }
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500

    return NextResponse.json(
      {
        status: health.status,
        checks: health.checks,
        resources,
        database: dbInfo,
        timestamp: health.timestamp
      },
      { status: statusCode }
    )
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date()
      },
      { status: 500 }
    )
  }
}
