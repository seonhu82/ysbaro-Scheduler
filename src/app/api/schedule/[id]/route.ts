// 스케줄 상세/수정/삭제

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                rank: true,
              },
            },
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    })

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    if (schedule.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: schedule,
    })
  } catch (error) {
    console.error('GET /api/schedule/[id] error:', error)
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
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status, assignments } = body

    const existing = await prisma.schedule.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    if (existing.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // 트랜잭션으로 업데이트
    const result = await prisma.$transaction(async (tx) => {
      const updateData: any = {}

      if (status) {
        updateData.status = status

        // DEPLOYED 상태로 변경 시 deployedAt 업데이트
        if (status === 'DEPLOYED') {
          updateData.deployedAt = new Date()
        }
      }

      // 스케줄 업데이트
      const updated = await tx.schedule.update({
        where: { id: params.id },
        data: updateData,
        include: {
          staffAssignments: {
            include: {
              staff: {
                select: {
                  id: true,
                  name: true,
                  rank: true,
                  color: true,
                },
              },
            },
            orderBy: {
              date: 'asc',
            },
          },
        },
      })

      // 직원 배치 업데이트가 있는 경우
      if (assignments && Array.isArray(assignments)) {
        // 기존 배치 삭제
        await tx.staffAssignment.deleteMany({
          where: { scheduleId: params.id },
        })

        // 새 배치 생성
        if (assignments.length > 0) {
          await tx.staffAssignment.createMany({
            data: assignments.map((assignment: any) => ({
              scheduleId: params.id,
              date: new Date(assignment.date),
              staffId: assignment.staffId,
              shiftType: assignment.shiftType || 'DAY',
            })),
          })
        }
      }

      // DEPLOYED 상태로 변경 시 알림 생성
      if (status === 'DEPLOYED' && existing.status !== 'DEPLOYED') {
        await tx.notification.create({
          data: {
            clinicId,
            type: 'SCHEDULE_DEPLOYED',
            title: '스케줄 배포',
            message: `${existing.year}년 ${existing.month}월 스케줄이 배포되었습니다.`,
          },
        })
      }

      return updated
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('PATCH /api/schedule/[id] error:', error)
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
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const existing = await prisma.schedule.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    if (existing.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // 배포된 스케줄은 삭제 불가
    if (existing.status === 'DEPLOYED') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete deployed schedule' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 삭제
    await prisma.$transaction(async (tx) => {
      // 직원 배치 먼저 삭제
      await tx.staffAssignment.deleteMany({
        where: { scheduleId: params.id },
      })

      // 스케줄 삭제
      await tx.schedule.delete({
        where: { id: params.id },
      })
    })

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error('DELETE /api/schedule/[id] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
