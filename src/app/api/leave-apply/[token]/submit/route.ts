import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCategoryAvailability } from '@/lib/services/category-slot-service'
import { fairnessValidationService } from '@/lib/services/fairness-validation-service'
import { leaveApplicationSchema, validateSchema, validationErrorResponse } from '@/lib/validation/schemas'
import { notifyLeaveApplication } from '@/lib/services/notification-helper'

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

    // 3. DailySlot 조회
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

    // 4. 공휴일 확인
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

    // 5. 형평성 검증
    const fairnessCheck = await fairnessValidationService.validateOffApplication(
      clinicId,
      staffId,
      applicationDate,
      hasNightShift,
      isHoliday
    )

    if (!fairnessCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: fairnessCheck.message,
        reason: fairnessCheck.reason,
        details: fairnessCheck.details
      }, { status: 400 })
    }

    // 6-7. 🔒 트랜잭션: 슬롯 확인 및 신청 생성
    // Serializable 격리 수준으로 Race Condition 방지
    const newApplication = await prisma.$transaction(async (tx) => {
      // 6-1. 현재 신청 수 카운트 (트랜잭션 내부)
      const currentApplications = await tx.leaveApplication.count({
        where: {
          date: applicationDate,
          status: { in: ['CONFIRMED', 'PENDING'] },
          staff: { clinicId }
        }
      })

      // 6-2. 구분별 신청 수 카운트
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

      // 6-3. 슬롯 가용성 재확인 (트랜잭션 내부에서 최신 데이터로)
      const categoryCheck = await checkCategoryAvailability(
        clinicId,
        applicationDate,
        requiredStaff,
        staff.categoryName || '',
        tx // 트랜잭션 컨텍스트 전달
      )

      // 6-4. 중복 신청 방지 (같은 날짜에 이미 신청했는지)
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

      // 7. 신청 생성
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

      console.log(`✅ 연차 신청 완료: ${staff.name} (${applicationDate.toISOString().split('T')[0]}) - ${status}`)

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
        : '신청이 완료되었습니다.'
    })

  } catch (error: any) {
    console.error('Leave application error:', error)

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
