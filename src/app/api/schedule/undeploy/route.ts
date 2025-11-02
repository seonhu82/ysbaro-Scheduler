/**
 * 스케줄 배포 취소 API
 * POST /api/schedule/undeploy
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { year, month, scheduleId } = body

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month are required' },
        { status: 400 }
      )
    }

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        clinicId,
        year,
        month,
        status: 'DEPLOYED'
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Deployed schedule not found' },
        { status: 404 }
      )
    }

    // 스케줄 상태를 CONFIRMED로 변경 (배포 취소)
    const updatedSchedule = await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'CONFIRMED',
        deployedAt: null,
        deployedStartDate: null,
        deployedEndDate: null
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedSchedule
    })
  } catch (error) {
    console.error('POST /api/schedule/undeploy error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
