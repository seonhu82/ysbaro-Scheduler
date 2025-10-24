import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: ON_HOLD 신청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const applications = await prisma.leaveApplication.findMany({
      where: {
        staff: { clinicId: session.user.clinicId },
        status: 'ON_HOLD'
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            categoryName: true,
            departmentName: true
          }
        }
      },
      orderBy: { date: 'asc' }
    })

    return NextResponse.json({
      success: true,
      applications
    })
  } catch (error) {
    console.error('Get ON_HOLD error:', error)
    return NextResponse.json(
      { error: 'Failed to get ON_HOLD applications' },
      { status: 500 }
    )
  }
}

// POST: ON_HOLD 신청 승인/반려
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { applicationId, action } = await request.json()

    if (!applicationId || !action) {
      return NextResponse.json(
        { error: 'applicationId and action are required' },
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    const application = await prisma.leaveApplication.findUnique({
      where: { id: applicationId },
      include: { staff: true }
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    if (application.staff.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (application.status !== 'ON_HOLD') {
      return NextResponse.json(
        { error: 'Not ON_HOLD status' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      await prisma.leaveApplication.update({
        where: { id: applicationId },
        data: {
          status: 'CONFIRMED',
          holdReason: null
        }
      })
    } else if (action === 'reject') {
      await prisma.leaveApplication.update({
        where: { id: applicationId },
        data: {
          status: 'REJECTED'
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'Application approved' : 'Application rejected'
    })
  } catch (error) {
    console.error('ON_HOLD action error:', error)
    return NextResponse.json(
      { error: 'Failed to process ON_HOLD application' },
      { status: 500 }
    )
  }
}
