import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/settings/departments/[id]
 * 부서 수정
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
    const departmentId = params.id

    // 부서 조회 및 권한 확인
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    })

    if (!department) {
      return NextResponse.json(
        { error: '부서를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (department.clinicId !== user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updates = await request.json()

    const updatedDepartment = await prisma.department.update({
      where: { id: departmentId },
      data: updates,
    })

    return NextResponse.json(updatedDepartment)
  } catch (error: any) {
    console.error('Department update error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '이미 존재하는 부서명입니다' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '부서 수정 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/departments/[id]
 * 부서 삭제
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
    const departmentId = params.id

    // 부서 조회 및 권한 확인
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    })

    if (!department) {
      return NextResponse.json(
        { error: '부서를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (department.clinicId !== user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.department.delete({
      where: { id: departmentId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Department deletion error:', error)
    return NextResponse.json(
      { error: '부서 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
