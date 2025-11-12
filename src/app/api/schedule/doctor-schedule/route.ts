/**
 * 원장 스케줄 삭제 API
 * DELETE: 특정 월의 원장 스케줄 삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { year, month } = body

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    const clinicId = session.user.clinicId

    // 해당 월의 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // 배포된 스케줄인지 확인
    if (schedule.status === 'DEPLOYED') {
      return NextResponse.json(
        { success: false, error: '배포된 스케줄은 삭제할 수 없습니다. 먼저 배포를 취소해주세요.' },
        { status: 400 }
      )
    }

    // 원장 스케줄 삭제
    const deleteResult = await prisma.scheduleDoctor.deleteMany({
      where: {
        scheduleId: schedule.id
      }
    })

    // Schedule의 weekPatterns도 초기화
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { weekPatterns: null }
    })

    console.log(`✅ ${year}년 ${month}월 원장 스케줄 ${deleteResult.count}건 삭제 완료`)

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count
    })
  } catch (error) {
    console.error('Delete doctor schedule error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete doctor schedule' },
      { status: 500 }
    )
  }
}
