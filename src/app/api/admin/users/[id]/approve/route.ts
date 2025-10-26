import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isSuperAdminOrAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/users/[id]/approve
 * 사용자 승인
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

    const { role } = await request.json()
    const userId = params.id

    if (!role || !['STAFF', 'MANAGER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: '유효한 역할을 선택해주세요' },
        { status: 400 }
      )
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { clinic: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // ADMIN은 본인 병원만 승인 가능
    if (
      (session.user as any).role === 'ADMIN' &&
      user.clinicId !== (session.user as any).clinicId
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 승인 처리
    const updatedUser = await prisma.$transaction(async (tx) => {
      // 사용자 업데이트
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          accountStatus: 'APPROVED',
          role: role,
          approvedBy: (session.user as any).id,
          approvedAt: new Date(),
        },
      })

      // 활동 로그 기록
      await tx.activityLog.create({
        data: {
          clinicId: user.clinicId!,
          userId: (session.user as any).id,
          activityType: 'USER_APPROVED',
          description: `사용자 승인: ${user.name} (${user.email}) - 역할: ${role}`,
          metadata: {
            approvedUserId: user.id,
            assignedRole: role,
          },
        },
      })

      // 승인 알림 전송
      await tx.notification.create({
        data: {
          clinicId: user.clinicId!,
          userId: user.id,
          type: 'USER_APPROVED',
          title: '회원 승인 완료',
          message: `계정이 승인되었습니다. 이제 로그인하여 시스템을 이용하실 수 있습니다.`,
          isRead: false,
        },
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      message: '사용자가 승인되었습니다',
      user: updatedUser,
    })
  } catch (error) {
    console.error('User approval error:', error)
    return NextResponse.json(
      { error: '사용자 승인 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
