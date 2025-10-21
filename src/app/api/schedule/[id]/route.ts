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
        entries: {
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
    const { status, entries } = body

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

        // PUBLISHED 상태로 변경 시 publishedAt 업데이트
        if (status === 'PUBLISHED') {
          updateData.publishedAt = new Date()
        }
      }

      // 스케줄 업데이트
      const updated = await tx.schedule.update({
        where: { id: params.id },
        data: updateData,
        include: {
          entries: {
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

      // 엔트리 업데이트가 있는 경우
      if (entries && Array.isArray(entries)) {
        // 기존 엔트리 삭제
        await tx.scheduleEntry.deleteMany({
          where: { scheduleId: params.id },
        })

        // 새 엔트리 생성
        if (entries.length > 0) {
          await tx.scheduleEntry.createMany({
            data: entries.map((entry: any) => ({
              scheduleId: params.id,
              clinicId,
              date: new Date(entry.date),
              staffId: entry.staffId,
              shiftType: entry.shiftType || 'FULL',
            })),
          })
        }
      }

      // PUBLISHED 상태로 변경 시 알림 생성
      if (status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
        await tx.notification.create({
          data: {
            clinicId,
            type: 'SCHEDULE_PUBLISHED',
            title: '스케줄 발행',
            message: `${existing.year}년 ${existing.month}월 스케줄이 발행되었습니다.`,
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

    // 발행된 스케줄은 삭제 불가
    if (existing.status === 'PUBLISHED') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete published schedule' },
        { status: 400 }
      )
    }

    // 트랜잭션으로 삭제
    await prisma.$transaction(async (tx) => {
      // 엔트리 먼저 삭제
      await tx.scheduleEntry.deleteMany({
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
