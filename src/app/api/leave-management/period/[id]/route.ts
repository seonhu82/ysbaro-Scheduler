import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/leave-management/period/[id]
 * 신청 기간 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { startDate, endDate, maxSlots, categorySlots, isActive } = body

    // 기존 기간 확인
    const existing = await prisma.leavePeriod.findFirst({
      where: {
        id,
        clinicId: session.user.clinicId
      }
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Period not found' },
        { status: 404 }
      )
    }

    // 업데이트 데이터 준비
    const updateData: any = {}

    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate)
    }
    if (endDate !== undefined) {
      updateData.endDate = new Date(endDate)
    }
    if (maxSlots !== undefined) {
      updateData.maxSlots = parseInt(maxSlots)
    }
    if (categorySlots !== undefined) {
      updateData.categorySlots = categorySlots
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    // 날짜 유효성 검증
    const finalStartDate = updateData.startDate || existing.startDate
    const finalEndDate = updateData.endDate || existing.endDate

    if (finalStartDate > finalEndDate) {
      return NextResponse.json(
        { success: false, error: 'Start date must be before end date' },
        { status: 400 }
      )
    }

    // 기간 업데이트
    const updated = await prisma.leavePeriod.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/leave-management/period/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update period' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/leave-management/period/[id]
 * 신청 기간 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    // 기존 기간 확인
    const existing = await prisma.leavePeriod.findFirst({
      where: {
        id,
        clinicId: session.user.clinicId
      }
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Period not found' },
        { status: 404 }
      )
    }

    // 기간 삭제
    await prisma.leavePeriod.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: 'Period deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/leave-management/period/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete period' },
      { status: 500 }
    )
  }
}
