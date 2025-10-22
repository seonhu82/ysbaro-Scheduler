// 원장 상세 조회/수정/삭제

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

    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      include: {
        patterns: {
          where: { isActive: true },
          include: {
            days: {
              orderBy: { dayOfWeek: 'asc' },
            },
          },
        },
      },
    })

    if (!doctor || doctor.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Doctor not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: doctor,
    })
  } catch (error) {
    console.error('GET /api/doctors/[id] error:', error)
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

    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
    })

    if (!doctor || doctor.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Doctor not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { name, specialization, isActive } = body

    const updated = await prisma.doctor.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(specialization !== undefined && { specialization }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        patterns: {
          where: { isActive: true },
          include: {
            days: {
              orderBy: { dayOfWeek: 'asc' },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('PATCH /api/doctors/[id] error:', error)
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

    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
    })

    if (!doctor || doctor.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Doctor not found' },
        { status: 404 }
      )
    }

    // Soft delete
    await prisma.doctor.update({
      where: { id: params.id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/doctors/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
