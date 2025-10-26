import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isSuperAdminOrAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/users/[id]/reject
 * 사용자 거절
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    // 권한 확인
    if (!session?.user || !isSuperAdminOrAdmin((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { reason } = await request.json()
    const userId = params.id

    if (!reason) {
      return NextResponse.json(
        { error: '거절 사유를 입력해주세요' },
        { status: 400 }
      )
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // ADMIN은 본인 병원만 거절 가능
    if (
      (session.user as any).role === 'ADMIN' &&
      user.clinicId !== (session.user as any).clinicId
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 거절 처리
    const updatedUser = await prisma.$transaction(async (tx) => {
      // 사용자 업데이트
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          accountStatus: 'REJECTED',
          rejectedReason: reason,
        },
      })

      // 활동 로그 기록
      await tx.activityLog.create({
        data: {
          clinicId: user.clinicId!,
          userId: (session.user as any).id,
          activityType: 'USER_REJECTED',
          description: `사용자 거절: ${user.name} (${user.email})`,
          metadata: {
            rejectedUserId: user.id,
            reason,
          },
        },
      })

      // 거절 알림 전송
      await tx.notification.create({
        data: {
          clinicId: user.clinicId!,
          userId: user.id,
          type: 'USER_REJECTED',
          title: '회원 승인 거절',
          message: `죄송합니다. 회원 승인이 거절되었습니다.\n사유: ${reason}`,
          isRead: false,
        },
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      message: '사용자가 거절되었습니다',
      user: updatedUser,
    })
  } catch (error) {
    console.error('User rejection error:', error)
    return NextResponse.json(
      { error: '사용자 거절 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
