/**
 * 스케줄 상태 조회 API
 * GET /api/schedule/status?year=2025&month=10
 *
 * 특정 년월의 스케줄 존재 여부 및 ID 반환
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    // DRAFT, CONFIRMED, DEPLOYED 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month,
        status: { in: ['DRAFT', 'CONFIRMED', 'DEPLOYED'] }
      },
      select: {
        id: true,
        year: true,
        month: true,
        status: true,
        createdAt: true,
        deployedAt: true,
        deployedStartDate: true,
        deployedEndDate: true
      }
    })

    return NextResponse.json({
      success: true,
      schedule,
      exists: !!schedule
    })

  } catch (error) {
    console.error('Schedule status check error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check schedule status' },
      { status: 500 }
    )
  }
}
