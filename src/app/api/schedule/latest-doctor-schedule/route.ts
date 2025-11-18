import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/schedule/latest-doctor-schedule
 * 최근 원장 스케줄이 있는 월 조회
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.clinicId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 가장 최근 스케줄 조회 (year, month 내림차순)
    const latestSchedule = await prisma.schedule.findFirst({
      where: {
        clinicId: session.user.clinicId,
        status: {
          in: ['DRAFT', 'CONFIRMED', 'DEPLOYED']
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      select: {
        year: true,
        month: true,
        status: true
      }
    })

    if (!latestSchedule) {
      return NextResponse.json({
        success: false,
        error: 'No schedule found'
      })
    }

    return NextResponse.json({
      success: true,
      schedule: latestSchedule
    })
  } catch (error) {
    console.error('GET /api/schedule/latest-doctor-schedule error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch latest schedule' },
      { status: 500 }
    )
  }
}
