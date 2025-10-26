// 직원 상세 조회/수정/삭제

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
    })

    if (!staff || staff.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...staff,
        pin: undefined, // PIN은 보안상 제외
      },
    })
  } catch (error) {
    console.error('GET /api/staff/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
    })

    if (!staff || staff.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, rank, phoneNumber, email, isActive, workType } = body

    // workType이 변경되면 workDays도 같이 업데이트
    const updateData: any = {
      ...(name && { name }),
      ...(rank && { rank }),
      ...(phoneNumber !== undefined && { phoneNumber }),
      ...(email !== undefined && { email }),
      ...(isActive !== undefined && { isActive }),
    }

    if (workType) {
      updateData.workType = workType
      updateData.workDays = workType === 'WEEK_4' ? 4 : 5
    }

    const updated = await prisma.staff.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        pin: undefined,
      },
    })
  } catch (error) {
    console.error('PATCH /api/staff/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
    })

    if (!staff || staff.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      )
    }

    // Soft delete
    await prisma.staff.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/staff/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
