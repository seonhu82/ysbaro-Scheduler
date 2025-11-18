/**
 * 연차/오프 신청 목록 조회 API
 * GET /api/leave/list?startDate=2025-11-01&endDate=2025-11-30
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
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate required' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    // 연차/오프 신청 조회
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: {
          gte: new Date(startDateStr),
          lte: new Date(endDateStr)
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            departmentName: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      leaves: leaves.map(leave => ({
        id: leave.id,
        staffId: leave.staffId,
        staffName: leave.staff.name,
        departmentName: leave.staff.departmentName,
        date: leave.date,
        leaveType: leave.leaveType,
        status: leave.status
      }))
    })
  } catch (error) {
    console.error('Error fetching leaves:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
