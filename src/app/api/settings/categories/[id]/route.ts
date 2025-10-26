import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/settings/categories/[id]
 * 구분 수정
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
    const categoryId = params.id

    // 구분 조회 및 권한 확인
    const category = await prisma.staffCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return NextResponse.json(
        { error: '구분을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (category.clinicId !== user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updates = await request.json()

    const updatedCategory = await prisma.staffCategory.update({
      where: { id: categoryId },
      data: updates,
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(updatedCategory)
  } catch (error: any) {
    console.error('Category update error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '이미 존재하는 구분명입니다' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '구분 수정 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/categories/[id]
 * 구분 삭제
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
    const categoryId = params.id

    // 구분 조회 및 권한 확인
    const category = await prisma.staffCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return NextResponse.json(
        { error: '구분을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (category.clinicId !== user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.staffCategory.delete({
      where: { id: categoryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Category deletion error:', error)
    return NextResponse.json(
      { error: '구분 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
