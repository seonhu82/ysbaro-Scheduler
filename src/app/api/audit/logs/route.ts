/**
 * 감사 로그 API
 *
 * GET /api/audit/logs - 감사 로그 검색
 * POST /api/audit/logs - 감사 로그 생성 (수동)
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchAuditLogs } from '@/lib/audit/audit-logger'
import { withErrorHandling } from '@/lib/error-tracking/with-error-handling'
import { ActivityType } from '@prisma/client'

async function handleGET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  try {
    const clinicId = searchParams.get('clinicId')
    const userId = searchParams.get('userId')
    const activityTypes = searchParams.get('activityTypes')?.split(',') as ActivityType[] | undefined
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const searchText = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'clinicId is required' },
        { status: 400 }
      )
    }

    const dateRange =
      fromDate && toDate
        ? {
            from: new Date(fromDate),
            to: new Date(toDate)
          }
        : undefined

    const logs = await searchAuditLogs({
      clinicId,
      userId: userId || undefined,
      activityTypes,
      dateRange,
      searchText: searchText || undefined,
      limit,
      offset
    })

    return NextResponse.json({
      success: true,
      data: logs,
      meta: {
        limit,
        offset,
        count: logs.length
      }
    })
  } catch (error) {
    console.error('Failed to search audit logs:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search audit logs'
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorHandling(handleGET)
