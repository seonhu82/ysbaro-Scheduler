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
    const { expiresAt } = body

    // ApplicationLink 조회
    const existing = await prisma.applicationLink.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Period not found' },
        { status: 404 }
      )
    }

    if (existing.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // 업데이트 데이터 준비
    const updateData: any = {}

    if (expiresAt !== undefined) {
      updateData.expiresAt = new Date(expiresAt)
    }

    // ApplicationLink 업데이트
    const updated = await prisma.applicationLink.update({
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

    // ApplicationLink 조회 (권한 확인용)
    const applicationLink = await prisma.applicationLink.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            applications: true
          }
        }
      }
    })

    if (!applicationLink) {
      return NextResponse.json(
        { success: false, error: 'Period not found' },
        { status: 404 }
      )
    }

    if (applicationLink.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // ApplicationLink 삭제 (관련 applications도 CASCADE로 삭제됨)
    await prisma.applicationLink.delete({
      where: { id }
    })

    // 관련 LeavePeriod도 삭제
    await prisma.leavePeriod.deleteMany({
      where: {
        clinicId: session.user.clinicId,
        year: applicationLink.year,
        month: applicationLink.month
      }
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
