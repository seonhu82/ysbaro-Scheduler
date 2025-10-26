import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/settings/categories/reorder
 * 구분 순서 변경
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasAdminPrivileges((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { categories } = await request.json()

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: '잘못된 요청입니다' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 순서 업데이트
    await prisma.$transaction(
      categories.map((cat: { id: string; order: number; priority?: number }) =>
        prisma.staffCategory.update({
          where: { id: cat.id },
          data: {
            order: cat.order,
            ...(cat.priority !== undefined && { priority: cat.priority }),
          },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Category reorder error:', error)
    return NextResponse.json(
      { error: '구분 순서 변경 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
