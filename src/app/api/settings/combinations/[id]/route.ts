import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/settings/combinations/[id]
 * 의사 조합 수정
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
    const combinationId = params.id

    // 조합 조회 및 권한 확인
    const combination = await prisma.doctorCombination.findUnique({
      where: { id: combinationId },
    })

    if (!combination) {
      return NextResponse.json(
        { error: '조합을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (combination.clinicId !== user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updates = await request.json()

    const updatedCombination = await prisma.doctorCombination.update({
      where: { id: combinationId },
      data: updates,
    })

    return NextResponse.json(updatedCombination)
  } catch (error) {
    console.error('Combination update error:', error)
    return NextResponse.json(
      { error: '조합 수정 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/combinations/[id]
 * 의사 조합 전체 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user || !hasAdminPrivileges((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const user = session.user as any
    const combinationId = params.id

    // 조합 조회 및 권한 확인
    const combination = await prisma.doctorCombination.findUnique({
      where: { id: combinationId },
    })

    if (!combination) {
      return NextResponse.json(
        { error: '조합을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (combination.clinicId !== user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()

    const updatedCombination = await prisma.doctorCombination.update({
      where: { id: combinationId },
      data: {
        name: body.name,
        dayOfWeek: body.dayOfWeek,
        requiredStaff: body.requiredStaff || 0,
        departmentRequiredStaff: body.departmentRequiredStaff || {},
        departmentCategoryStaff: body.departmentCategoryStaff || {},
        doctors: body.doctors || [],
        hasNightShift: body.hasNightShift || false,
      },
    })

    return NextResponse.json({ success: true, data: updatedCombination })
  } catch (error) {
    console.error('Combination update error:', error)
    return NextResponse.json(
      { error: '조합 수정 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/combinations/[id]
 * 의사 조합 삭제
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
    const combinationId = params.id

    // 조합 조회 및 권한 확인
    const combination = await prisma.doctorCombination.findUnique({
      where: { id: combinationId },
    })

    if (!combination) {
      return NextResponse.json(
        { error: '조합을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (combination.clinicId !== user.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await prisma.doctorCombination.delete({
      where: { id: combinationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Combination deletion error:', error)
    return NextResponse.json(
      { error: '조합 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
