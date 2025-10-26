import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/departments
 * 부서 목록 조회
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

    const departments = await prisma.department.findMany({
      where: { clinicId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(departments)
  } catch (error) {
    console.error('Departments list error:', error)
    return NextResponse.json(
      { error: '부서 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/departments
 * 부서 생성
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

    const { name, useAutoAssignment } = await request.json()

    if (!name) {
      return NextResponse.json(
        { error: '부서명을 입력해주세요' },
        { status: 400 }
      )
    }

    // 현재 최대 order 값 조회
    const maxOrder = await prisma.department.findFirst({
      where: { clinicId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const department = await prisma.department.create({
      data: {
        clinicId,
        name,
        useAutoAssignment: useAutoAssignment ?? true,
        order: (maxOrder?.order ?? -1) + 1,
      },
    })

    return NextResponse.json(department)
  } catch (error: any) {
    console.error('Department creation error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '이미 존재하는 부서명입니다' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: '부서 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
