import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/settings/weekly-patterns/[id]
 * 주간 패턴 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasAdminPrivileges((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const user = session.user as any
    const patternId = params.id

    // 패턴 조회 및 권한 확인
    const pattern = await prisma.weeklyPattern.findUnique({
      where: { id: patternId },
    })

    if (!pattern) {
      return NextResponse.json(
        { error: '주간 패턴을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (pattern.clinicId !== user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { name, description, isDefault, isActive, days } = await request.json()

    // 기본 패턴으로 설정할 경우 기존 기본 패턴 해제
    if (isDefault && !pattern.isDefault) {
      await prisma.weeklyPattern.updateMany({
        where: { clinicId: user.clinicId, isDefault: true },
        data: { isDefault: false },
      })
    }

    // 패턴 수정
    const updatedPattern = await prisma.weeklyPattern.update({
      where: { id: patternId },
      data: {
        name,
        description,
        isDefault,
        isActive,
      },
      include: {
        days: {
          include: {
            combination: true,
          },
        },
      },
    })

    // 요일별 조합 업데이트 (days가 제공된 경우)
    if (days && Array.isArray(days)) {
      // 기존 요일 삭제
      await prisma.weeklyPatternDay.deleteMany({
        where: { weeklyPatternId: patternId },
      })

      // 새 요일 생성
      await prisma.weeklyPatternDay.createMany({
        data: days.map((day: any) => ({
          weeklyPatternId: patternId,
          dayOfWeek: day.dayOfWeek,
          combinationId: day.combinationId || null,
          isClosedDay: day.isClosedDay || false,
        })),
      })
    }

    // 최종 데이터 반환
    const finalPattern = await prisma.weeklyPattern.findUnique({
      where: { id: patternId },
      include: {
        days: {
          include: {
            combination: true,
          },
        },
      },
    })

    return NextResponse.json(finalPattern)
  } catch (error) {
    console.error('Weekly pattern update error:', error)
    return NextResponse.json(
      { error: '주간 패턴 수정 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/weekly-patterns/[id]
 * 주간 패턴 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasAdminPrivileges((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const user = session.user as any
    const patternId = params.id

    // 패턴 조회 및 권한 확인
    const pattern = await prisma.weeklyPattern.findUnique({
      where: { id: patternId },
    })

    if (!pattern) {
      return NextResponse.json(
        { error: '주간 패턴을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (pattern.clinicId !== user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 기본 패턴은 삭제 불가
    if (pattern.isDefault) {
      return NextResponse.json(
        { error: '기본 패턴은 삭제할 수 없습니다. 먼저 다른 패턴을 기본으로 설정해주세요.' },
        { status: 400 }
      )
    }

    await prisma.weeklyPattern.delete({
      where: { id: patternId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Weekly pattern deletion error:', error)
    return NextResponse.json(
      { error: '주간 패턴 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
