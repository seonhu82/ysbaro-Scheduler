import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/categories
 * 구분 목록 조회
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

    const categories = await prisma.staffCategory.findMany({
      where: { clinicId },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { order: 'asc' }],
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Categories list error:', error)
    return NextResponse.json(
      { error: '구분 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/categories
 * 구분 생성
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

    const { name, priority, departmentId } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: '구분명을 입력해주세요' },
        { status: 400 }
      )
    }

    // 현재 최대 order 값 조회
    const maxOrder = await prisma.staffCategory.findFirst({
      where: { clinicId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const category = await prisma.staffCategory.create({
      data: {
        clinicId,
        name,
        priority: priority ?? 0,
        departmentId: departmentId || null,
        order: (maxOrder?.order ?? -1) + 1,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(category)
  } catch (error: any) {
    console.error('Category creation error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '이미 존재하는 구분명입니다' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '구분 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
