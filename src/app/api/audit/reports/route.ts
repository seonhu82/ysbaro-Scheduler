/**
 * 감사 리포트 API
 *
 * GET /api/audit/reports/user - 사용자 활동 리포트
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateUserActivityReport } from '@/lib/audit/audit-logger'
import { withErrorHandling } from '@/lib/error-tracking/with-error-handling'

async function handleGET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  try {
    const userId = searchParams.get('userId')
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    if (!fromDate || !toDate) {
      return NextResponse.json(
        { success: false, error: 'Date range (from, to) is required' },
        { status: 400 }
      )
    }

    const report = await generateUserActivityReport(userId, {
      from: new Date(fromDate),
      to: new Date(toDate)
    })

    return NextResponse.json({
      success: true,
      data: report
    })
  } catch (error) {
    console.error('Failed to generate user activity report:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate report'
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorHandling(handleGET)
