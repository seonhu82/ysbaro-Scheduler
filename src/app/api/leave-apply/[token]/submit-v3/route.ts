/**
 * 연차/오프 신청 API V3
 * - 동적 제한 시스템 통합: 자동 배치 가능성을 사전 검증
 * - 제약 조건 시뮬레이션 (주4일, 구분별 인원, 편차)
 * - 사용자 친화적 거절 메시지
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCategoryAvailability } from '@/lib/services/category-slot-service'
import { checkDynamicFairness } from '@/lib/services/dynamic-fairness-calculator'
import { leaveApplicationSchema, validateSchema, validationErrorResponse } from '@/lib/validation/schemas'
import { notifyLeaveApplication } from '@/lib/services/notification-helper'
import { simulateScheduleWithLeave } from '@/lib/services/leave-eligibility-simulator'
import { buildRejectionMessage } from '@/lib/services/leave-rejection-message-builder'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await request.json()

    // 입력 검증
    const validation = validateSchema(leaveApplicationSchema, body)

    if (!validation.success) {
      return NextResponse.json(validationErrorResponse(validation.errors), { status: 400 })
    }

    const { date, type, pin } = validation.data

    // 1. Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
      include: { staff: true }
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 404 }
      )
    }

    // 2. PIN으로 직원 조회
    let staff
    if (link.staffId) {
      // 특정 직원용 링크
      if (!link.staff) {
        return NextResponse.json(
          { success: false, error: 'Staff not found' },
          { status: 404 }
        )
      }
      if (link.staff.pin !== pin) {
        return NextResponse.json(
          { success: false, error: 'Invalid PIN' },
          { status: 401 }
        )
      }
      staff = link.staff
    } else {
      // 전체 직원용 링크
      staff = await prisma.staff.findFirst({
        where: {
          clinicId: link.clinicId,
          pin,
          isActive: true
        }
      })

      if (!staff) {
        return NextResponse.json(
          { success: false, error: 'Invalid PIN' },
          { status: 401 }
        )
      }
    }

    const staffId = staff.id
    const clinicId = staff.clinicId
    const applicationDate = new Date(date)
    const year = applicationDate.getFullYear()
    const month = applicationDate.getMonth() + 1

    // 3. 📊 시뮬레이션: 자동 배치 가능성 사전 검증
    console.log(`🔍 [동적 제한] 시뮬레이션 시작: ${staff.name} - ${date} (${type})`)

    const simulation = await simulateScheduleWithLeave({
      clinicId,
      staffId,
      leaveDate: applicationDate,
      leaveType: type,
      year,
      month,
    })

    if (!simulation.feasible) {
      console.log(`❌ [동적 제한] 시뮬레이션 실패: ${simulation.reason}`)
      const rejectionMessage = buildRejectionMessage(simulation)

      return NextResponse.json({
        success: false,
        error: rejectionMessage.message,
        title: rejectionMessage.title,
        suggestion: rejectionMessage.suggestion,
        technicalReason: simulation.technicalReason,
        reason: simulation.reason,
        details: simulation.details,
        userMessage: {
          title: rejectionMessage.title,
          message: rejectionMessage.message,
          suggestion: rejectionMessage.suggestion,
          icon: rejectionMessage.icon,
        }
      }, { status: 400 })
    }

    console.log(`✅ [동적 제한] 시뮬레이션 통과: 자동 배치 가능`)

    // 4. DailySlot 조회
    const dailySlot = await prisma.dailySlot.findFirst({
      where: {
        date: applicationDate,
        week: { clinicId }
      },
      include: {
        week: true
      }
    })

    if (!dailySlot) {
      return NextResponse.json(
        { success: false, error: 'No schedule for this date' },
        { status: 400 }
      )
    }

    const requiredStaff = dailySlot.requiredStaff

    // doctorSchedule에서 hasNightShift 확인
    const doctorSchedule = dailySlot.doctorSchedule as any
    const hasNightShift = doctorSchedule?.night_shift || false

    // 5. 공휴일 확인
    const dayOfWeek = applicationDate.getDay()
    let isHoliday = dayOfWeek === 0

    if (!isHoliday) {
      const holiday = await prisma.holiday.findFirst({
        where: {
          clinicId,
          date: applicationDate
        }
      })
      isHoliday = !!holiday
    }

    // 6. 동적 형평성 검증 (OFF만 해당)
    if (type === 'OFF') {
      const fairnessCheck = await checkDynamicFairness(
        clinicId,
        staffId,
        applicationDate,
        link.year,
        link.month
      )

      if (!fairnessCheck.allowed) {
        return NextResponse.json({
          success: false,
          error: fairnessCheck.reason || '형평성 기준을 초과했습니다',
          details: fairnessCheck.details
        }, { status: 400 })
      }
    }

    // 7-8. 🔒 트랜잭션: 슬롯 확인 및 신청 생성
    // Serializable 격리 수준으로 Race Condition 방지
    const newApplication = await prisma.$transaction(async (tx) => {
      // 7-1. 연차 신청인 경우, 일일 최대 연차 신청 인원 확인
      if (type === 'ANNUAL') {
        // LeavePeriod에서 maxSlots 가져오기
        const leavePeriod = await tx.leavePeriod.findUnique({
          where: {
            clinicId_year_month: {
              clinicId,
              year,
              month
            }
          }
        })

        if (leavePeriod && leavePeriod.maxSlots > 0) {
          // 해당 날짜의 연차 신청 수 카운트 (ANNUAL만)
          const annualApplicationCount = await tx.leaveApplication.count({
            where: {
              date: applicationDate,
              leaveType: 'ANNUAL',
              status: { in: ['CONFIRMED', 'PENDING'] },
              staff: { clinicId }
            }
          })

          if (annualApplicationCount >= leavePeriod.maxSlots) {
            throw new Error(`하루 최대 연차 신청 인원(${leavePeriod.maxSlots}명)을 초과했습니다.`)
          }
        }
      }

      // 7-2. 현재 신청 수 카운트 (트랜잭션 내부)
      const currentApplications = await tx.leaveApplication.count({
        where: {
          date: applicationDate,
          status: { in: ['CONFIRMED', 'PENDING'] },
          staff: { clinicId }
        }
      })

      // 7-3. 구분별 신청 수 카운트
      const categoryApplications = await tx.leaveApplication.count({
        where: {
          date: applicationDate,
          status: { in: ['CONFIRMED', 'PENDING'] },
          staff: {
            clinicId,
            categoryName: staff.categoryName
          }
        }
      })

      // 7-4. 슬롯 가용성 재확인 (트랜잭션 내부에서 최신 데이터로)
      const categoryCheck = await checkCategoryAvailability(
        clinicId,
        applicationDate,
        requiredStaff,
        staff.categoryName || ''
      )

      // 7-5. 중복 신청 방지 (같은 날짜에 이미 신청했는지)
      const existingApplication = await tx.leaveApplication.findFirst({
        where: {
          staffId,
          date: applicationDate,
          status: { not: 'REJECTED' }
        }
      })

      if (existingApplication) {
        throw new Error('DUPLICATE_APPLICATION')
      }

      // 8. 신청 생성
      let status: 'PENDING' | 'ON_HOLD' = 'PENDING'
      let holdReason: string | null = null

      if (categoryCheck.shouldHold) {
        status = 'ON_HOLD'
        holdReason = categoryCheck.message
      }

      const application = await tx.leaveApplication.create({
        data: {
          clinicId,
          staffId,
          date: applicationDate,
          leaveType: type,
          status,
          holdReason,
          linkId: link.id
        }
      })

      console.log(`✅ [동적 제한] 신청 완료: ${staff.name} (${applicationDate.toISOString().split('T')[0]}) - ${status}`)

      return application
    }, {
      isolationLevel: 'Serializable' // 최고 격리 수준으로 Race Condition 완전 차단
    })

    // 🔔 알림 전송 (비동기, 실패해도 무시)
    try {
      // 관리자 사용자 ID 조회
      const adminUsers = await prisma.user.findMany({
        where: {
          clinicId,
          role: { in: ['ADMIN', 'MANAGER'] },
          accountStatus: 'APPROVED'
        },
        select: { id: true }
      })

      if (adminUsers.length > 0) {
        await notifyLeaveApplication(
          staffId,
          staff.name || '직원',
          applicationDate,
          type,
          adminUsers.map(u => u.id)
        )
      }
    } catch (notificationError) {
      console.error('알림 전송 실패 (무시):', notificationError)
    }

    return NextResponse.json({
      success: true,
      application: newApplication,
      status: newApplication.status,
      message: newApplication.status === 'ON_HOLD'
        ? `보류되었습니다: ${newApplication.holdReason}`
        : '신청이 완료되었습니다. 나머지 OFF는 자동 배치 시스템이 형평성을 고려하여 배정합니다.'
    })

  } catch (error: any) {
    console.error('[동적 제한] Leave application error:', error)

    // 중복 신청 에러 처리
    if (error.message === 'DUPLICATE_APPLICATION') {
      return NextResponse.json(
        {
          success: false,
          error: '이미 해당 날짜에 신청하셨습니다.'
        },
        { status: 409 }
      )
    }

    // 최대 연차 신청 인원 초과 에러 처리
    if (error.message?.includes('하루 최대 연차 신청 인원')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        { status: 400 }
      )
    }

    // 동시성 에러 처리
    if (error.code === 'P2034') { // Prisma transaction conflict
      return NextResponse.json(
        {
          success: false,
          error: '동시에 여러 신청이 발생했습니다. 잠시 후 다시 시도해주세요.'
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to submit application' },
      { status: 500 }
    )
  }
}
