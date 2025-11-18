import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/admin/users/[id]/status
 * 회원 상태 변경 (SUPER_ADMIN 전용)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    // SUPER_ADMIN만 접근 가능
    if (!session?.user || (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const userId = params.id
    const body = await request.json()
    const { accountStatus, role, suspendedReason, suspendedUntil } = body

    // 유효성 검사
    if (!accountStatus && !role) {
      return NextResponse.json(
        { success: false, error: 'accountStatus 또는 role이 필요합니다' },
        { status: 400 }
      )
    }

    const updateData: any = {}

    if (accountStatus) {
      updateData.accountStatus = accountStatus

      // 정지 상태인 경우
      if (accountStatus === 'SUSPENDED') {
        if (!suspendedReason) {
          return NextResponse.json(
            { success: false, error: '정지 사유가 필요합니다' },
            { status: 400 }
          )
        }
        updateData.suspendedReason = suspendedReason
        updateData.suspendedUntil = suspendedUntil ? new Date(suspendedUntil) : null
      } else {
        // 정지 해제 시
        updateData.suspendedReason = null
        updateData.suspendedUntil = null
      }
    }

    if (role) {
      updateData.role = role
    }

    // 사용자 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        suspendedReason: true,
        suspendedUntil: true,
      },
    })

    // 활동 로그 기록
    await prisma.activityLog.create({
      data: {
        userId: (session.user as any).id,
        clinicId: (session.user as any).clinicId || null,
        activityType: 'USER_STATUS_CHANGED',
        description: `회원 상태 변경: ${updatedUser.email} - ${accountStatus || ''}${role ? ` / 역할: ${role}` : ''}`,
        metadata: {
          targetUserId: userId,
          changes: updateData,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedUser,
    })
  } catch (error) {
    console.error('PUT /api/admin/users/[id]/status error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update user status' },
      { status: 500 }
    )
  }
}
