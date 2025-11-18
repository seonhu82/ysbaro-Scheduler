import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hash, compare } from 'bcryptjs'

/**
 * PUT /api/user/password
 * 본인 비밀번호 변경
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { currentPassword, newPassword } = body

    // 유효성 검사
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호와 새 비밀번호를 입력해주세요' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: '새 비밀번호는 최소 8자 이상이어야 합니다' },
        { status: 400 }
      )
    }

    // 현재 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 현재 비밀번호 확인
    const isPasswordValid = await compare(currentPassword, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호가 일치하지 않습니다' },
        { status: 400 }
      )
    }

    // 새 비밀번호 해싱
    const hashedPassword = await hash(newPassword, 10)

    // 비밀번호 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    })

    // 활동 로그 기록 (clinicId가 있을 때만)
    if ((session.user as any).clinicId) {
      try {
        await prisma.activityLog.create({
          data: {
            userId: userId,
            clinicId: (session.user as any).clinicId,
            activityType: 'PASSWORD_CHANGED',
            description: '비밀번호 변경',
            metadata: {},
          },
        })
      } catch (logError) {
        // 로그 기록 실패는 무시
        console.error('Activity log creation failed:', logError)
      }
    }

    return NextResponse.json({
      success: true,
      message: '비밀번호가 변경되었습니다',
    })
  } catch (error) {
    console.error('PUT /api/user/password error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update password' },
      { status: 500 }
    )
  }
}
