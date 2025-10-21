// 연차 신청 상세 조회 및 상태 변경

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
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

    const application = await prisma.leaveApplication.findUnique({
      where: { id: params.id },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            email: true,
          },
        },
        link: {
          select: {
            year: true,
            month: true,
            token: true,
          },
        },
      },
    })

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    // 권한 확인: 본인이거나 ADMIN/MANAGER
    if (
      application.clinicId !== clinicId ||
      (application.staffId !== session.user.staffId &&
        !['ADMIN', 'MANAGER'].includes(session.user.role))
    ) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: application,
    })
  } catch (error) {
    console.error('GET /api/leave-management/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

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
    const { status } = body

    if (!status || !['CONFIRMED', 'CANCELLED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    // 기존 신청 조회
    const existing = await prisma.leaveApplication.findUnique({
      where: { id: params.id },
      include: {
        staff: {
          select: {
            name: true,
          },
        },
        link: {
          include: {
            slotLimits: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    if (existing.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // 이미 처리된 신청은 변경 불가
    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Application already processed' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 업데이트
    const result = await prisma.$transaction(async (tx) => {
      // 상태 업데이트
      const updated = await tx.leaveApplication.update({
        where: { id: params.id },
        data: { status },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              rank: true,
              email: true,
            },
          },
        },
      })

      // CANCELLED인 경우 슬롯 감소
      if (status === 'CANCELLED') {
        const slotLimit = existing.link.slotLimits.find(
          (s) =>
            s.date.getFullYear() === existing.date.getFullYear() &&
            s.date.getMonth() === existing.date.getMonth() &&
            s.date.getDate() === existing.date.getDate()
        )

        if (slotLimit && slotLimit.currentSlots > 0) {
          await tx.slotLimit.update({
            where: { id: slotLimit.id },
            data: {
              currentSlots: {
                decrement: 1,
              },
            },
          })
        }
      }

      // 알림 생성
      const notificationTitle =
        status === 'CONFIRMED' ? '연차 승인' : '연차 취소'
      const notificationMessage =
        status === 'CONFIRMED'
          ? `${existing.staff.name}님의 ${existing.date.toLocaleDateString('ko-KR')} ${
              existing.leaveType === 'ANNUAL' ? '연차' : '오프'
            } 신청이 승인되었습니다.`
          : `${existing.staff.name}님의 ${existing.date.toLocaleDateString('ko-KR')} ${
              existing.leaveType === 'ANNUAL' ? '연차' : '오프'
            } 신청이 취소되었습니다.`

      await tx.notification.create({
        data: {
          clinicId,
          type: status === 'CONFIRMED' ? 'LEAVE_CONFIRMED' : 'LEAVE_CANCELLED',
          title: notificationTitle,
          message: notificationMessage,
        },
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('PATCH /api/leave-management/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
