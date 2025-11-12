import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/leave-management/period/[id]/confirm
 * 신청 기간 확정
 * - 모든 신청이 승인(CONFIRMED) 상태여야 확정 가능
 * - 대기중(PENDING) 신청이 있으면 확정 불가
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params
    const clinicId = session.user.clinicId

    // ApplicationLink 조회
    const applicationLink = await prisma.applicationLink.findUnique({
      where: { id },
      include: {
        applications: {
          select: {
            status: true
          }
        }
      }
    })

    if (!applicationLink) {
      return NextResponse.json(
        { success: false, error: 'Period not found' },
        { status: 404 }
      )
    }

    if (applicationLink.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // 대기중인 신청이 있는지 확인
    const hasPendingApplications = applicationLink.applications.some(
      app => app.status === 'PENDING'
    )

    if (hasPendingApplications) {
      const pendingCount = applicationLink.applications.filter(
        app => app.status === 'PENDING'
      ).length

      return NextResponse.json(
        {
          success: false,
          error: `확정할 수 없습니다. 대기중인 신청이 ${pendingCount}건 있습니다.\n모든 신청을 승인하거나 취소한 후 확정해주세요.`,
          pendingCount
        },
        { status: 400 }
      )
    }

    // 확정 처리
    const updated = await prisma.applicationLink.update({
      where: { id },
      data: {
        status: 'CONFIRMED'
      }
    })

    console.log(`✅ 신청기간 확정: ${applicationLink.year}년 ${applicationLink.month}월`)

    return NextResponse.json({
      success: true,
      data: updated,
      message: '신청 기간이 확정되었습니다.'
    })

  } catch (error: any) {
    console.error('POST /api/leave-management/period/[id]/confirm error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to confirm period' },
      { status: 500 }
    )
  }
}
