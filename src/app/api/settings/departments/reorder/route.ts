import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/settings/departments/reorder
 * 부서 순서 변경
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasAdminPrivileges((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { departments } = await request.json()

    if (!Array.isArray(departments)) {
      return NextResponse.json(
        { error: '잘못된 요청입니다' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 순서 업데이트
    await prisma.$transaction(
      departments.map((dept: { id: string; order: number }) =>
        prisma.department.update({
          where: { id: dept.id },
          data: { order: dept.order },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Department reorder error:', error)
    return NextResponse.json(
      { error: '부서 순서 변경 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
