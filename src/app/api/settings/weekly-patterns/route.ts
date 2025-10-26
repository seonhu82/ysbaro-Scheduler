import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/weekly-patterns
 * 주간 패턴 목록 조회
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const clinicId = user.clinicId

    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 400 })
    }

    const patterns = await prisma.weeklyPattern.findMany({
      where: { clinicId },
      include: {
        days: {
          include: {
            combination: true,
          },
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json(patterns)
  } catch (error) {
    console.error('Weekly patterns list error:', error)
    return NextResponse.json(
      { error: '주간 패턴 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/weekly-patterns
 * 주간 패턴 생성
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasAdminPrivileges((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const user = session.user as any
    const clinicId = user.clinicId

    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 400 })
    }

    const { name, description, isDefault, days } = await request.json()

    // 기본 패턴으로 설정할 경우 기존 기본 패턴 해제
    if (isDefault) {
      await prisma.weeklyPattern.updateMany({
        where: { clinicId, isDefault: true },
        data: { isDefault: false },
      })
    }

    // 패턴 생성
    const pattern = await prisma.weeklyPattern.create({
      data: {
        clinicId,
        name,
        description,
        isDefault: isDefault || false,
        days: {
          create: days.map((day: any) => ({
            dayOfWeek: day.dayOfWeek,
            combinationId: day.combinationId || null,
            isClosedDay: day.isClosedDay || false,
          })),
        },
      },
      include: {
        days: {
          include: {
            combination: true,
          },
        },
      },
    })

    return NextResponse.json(pattern)
  } catch (error) {
    console.error('Weekly pattern creation error:', error)
    return NextResponse.json(
      { error: '주간 패턴 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
