/**
 * 스케줄 배포 API (Wizard Step 4용)
 * POST /api/schedule/deploy
 *
 * 스케줄 배포 프로세스:
 * - DRAFT 상태 스케줄을 DEPLOYED로 변경
 * - 동일 월의 다른 스케줄을 ARCHIVED로 처리
 * - 배포 알림 발송 (TODO)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { year, month, scheduleId } = body

    if (!year || !month || !scheduleId) {
      return NextResponse.json(
        { success: false, error: 'Year, month, and scheduleId required' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    console.log(`\n🚀 스케줄 배포 시작: ${year}년 ${month}월 (ID: ${scheduleId})`)

    // 1. 스케줄 존재 및 권한 확인
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        clinicId,
        year,
        month
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: '스케줄을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (schedule.status === 'DEPLOYED') {
      return NextResponse.json(
        { success: false, error: '이미 배포된 스케줄입니다' },
        { status: 400 }
      )
    }

    // 2. 배포 날짜 범위 계산 (ScheduleDoctor의 최소/최대 날짜)
    const dateRange = await prisma.scheduleDoctor.aggregate({
      where: { scheduleId },
      _min: { date: true },
      _max: { date: true }
    })

    const deployedStartDate = dateRange._min.date
    const deployedEndDate = dateRange._max.date

    if (!deployedStartDate || !deployedEndDate) {
      return NextResponse.json(
        { success: false, error: '원장 스케줄이 없어 배포할 수 없습니다' },
        { status: 400 }
      )
    }

    console.log(`   📅 배포 범위: ${deployedStartDate.toISOString().split('T')[0]} ~ ${deployedEndDate.toISOString().split('T')[0]}`)

    // 3. 트랜잭션으로 배포 처리
    await prisma.$transaction(async (tx) => {
      // 3-1. 동일 월의 다른 DEPLOYED 스케줄 삭제
      // (ARCHIVED 상태가 enum에 없으므로 삭제로 처리)
      await tx.schedule.deleteMany({
        where: {
          clinicId,
          year,
          month,
          id: { not: scheduleId },
          status: 'DEPLOYED'
        }
      })

      // 3-2. 현재 스케줄을 DEPLOYED로 변경 + 배포 날짜 범위 저장
      await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          status: 'DEPLOYED',
          deployedAt: new Date(),
          deployedStartDate,
          deployedEndDate
        }
      })
    })

    console.log(`   ✅ 스케줄 배포 완료`)

    // 3. 배포된 스케줄 조회 (상세 정보 포함)
    const deployedSchedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        doctors: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                shortName: true
              }
            }
          }
        },
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                rank: true,
                categoryName: true
              }
            }
          }
        }
      }
    })

    // 4. 통계 계산
    const totalAssignments = deployedSchedule?.staffAssignments?.length || 0

    console.log(`   📊 총 배정: ${totalAssignments}건`)
    console.log(`   📅 배포 시간: ${deployedSchedule?.deployedAt}\n`)

    // TODO: 5. 직원들에게 배포 알림 발송
    // - 이메일 또는 앱 푸시 알림
    // - QR 디스플레이 자동 업데이트

    return NextResponse.json({
      success: true,
      schedule: {
        id: deployedSchedule?.id,
        year: deployedSchedule?.year,
        month: deployedSchedule?.month,
        status: deployedSchedule?.status,
        deployedAt: deployedSchedule?.deployedAt,
        totalAssignments
      }
    })

  } catch (error) {
    console.error('Deploy error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to deploy schedule' },
      { status: 500 }
    )
  }
}
