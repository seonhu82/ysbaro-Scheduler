/**
 * 연차/오프 신청 API V3
 * - 동적 제한 시스템 통합: 자동 배치 가능성을 사전 검증
 * - 제약 조건 시뮬레이션 (주4일, 구분별 인원, 편차)
 * - 사용자 친화적 거절 메시지
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

    const { date, type, pin, otherSelectedDates = [] } = validation.data

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

    // 2. PIN 또는 생년월일로 직원 조회
    let staff
    if (link.staffId) {
      // 특정 직원용 링크
      if (!link.staff) {
        return NextResponse.json(
          { success: false, error: 'Staff not found' },
          { status: 404 }
        )
      }

      // 🔐 PIN 설정 여부에 따라 인증 (생년월일도 허용)
      if (link.staff.pinCode) {
        // PIN이 설정되어 있으면 PIN 또는 생년월일로 인증 (전환기 지원)
        const isPinMatch = link.staff.pinCode === pin
        let isBirthdateMatch = false

        // PIN이 일치하지 않으면 생년월일도 확인
        if (!isPinMatch && pin.length === 6) {
          const inputYear = parseInt(pin.substring(0, 2))
          const inputMonth = parseInt(pin.substring(2, 4))
          const inputDay = parseInt(pin.substring(4, 6))
          const fullYear = inputYear >= 50 ? 1900 + inputYear : 2000 + inputYear

          const staffBirthDate = new Date(link.staff.birthDate)
          const dbYear = staffBirthDate.getUTCFullYear()
          const dbMonth = staffBirthDate.getUTCMonth() + 1
          const dbDay = staffBirthDate.getUTCDate()

          isBirthdateMatch = (fullYear === dbYear && inputMonth === dbMonth && inputDay === dbDay)
        }

        // PIN도 생년월일도 일치하지 않으면 인증 실패
        if (!isPinMatch && !isBirthdateMatch) {
          return NextResponse.json(
            { success: false, error: 'Invalid PIN or birthdate' },
            { status: 401 }
          )
        }
      } else {
        // PIN이 없으면 생년월일로 인증
        if (pin.length !== 6) {
          return NextResponse.json(
            { success: false, error: '생년월일은 6자리입니다 (YYMMDD)' },
            { status: 400 }
          )
        }

        const inputYear = parseInt(pin.substring(0, 2))
        const inputMonth = parseInt(pin.substring(2, 4))
        const inputDay = parseInt(pin.substring(4, 6))
        const fullYear = inputYear >= 50 ? 1900 + inputYear : 2000 + inputYear

        const staffBirthDate = new Date(link.staff.birthDate)
        const dbYear = staffBirthDate.getUTCFullYear()
        const dbMonth = staffBirthDate.getUTCMonth() + 1
        const dbDay = staffBirthDate.getUTCDate()

        if (fullYear !== dbYear || inputMonth !== dbMonth || inputDay !== dbDay) {
          return NextResponse.json(
            { success: false, error: 'Invalid birthdate' },
            { status: 401 }
          )
        }
      }

      staff = link.staff
    } else {
      // 전체 직원용 링크 - PIN으로 먼저 조회
      staff = await prisma.staff.findFirst({
        where: {
          clinicId: link.clinicId,
          pinCode: pin,
          isActive: true
        }
      })

      // PIN으로 못 찾으면 생년월일로 조회 (PIN 설정 여부 무관)
      if (!staff && pin.length === 6) {
        const inputYear = parseInt(pin.substring(0, 2))
        const inputMonth = parseInt(pin.substring(2, 4))
        const inputDay = parseInt(pin.substring(4, 6))
        const fullYear = inputYear >= 50 ? 1900 + inputYear : 2000 + inputYear

        // 생년월일이 일치하는 직원 찾기 (PIN 설정 여부 무관)
        const allStaff = await prisma.staff.findMany({
          where: {
            clinicId: link.clinicId,
            isActive: true,
          }
        })

        for (const s of allStaff) {
          if (!s.birthDate) continue

          const staffBirthDate = new Date(s.birthDate)
          const dbYear = staffBirthDate.getUTCFullYear()
          const dbMonth = staffBirthDate.getUTCMonth() + 1
          const dbDay = staffBirthDate.getUTCDate()

          if (fullYear === dbYear && inputMonth === dbMonth && inputDay === dbDay) {
            staff = s
            break
          }
        }
      }

      if (!staff) {
        return NextResponse.json(
          { success: false, error: 'Invalid PIN or birthdate' },
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

    // 4. ScheduleDoctor 확인 (DailySlot보다 우선)
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date: applicationDate,
        schedule: {
          clinicId,
          year,
          month
        }
      }
    })

    // ScheduleDoctor가 없으면 해당 날짜에 스케줄이 없는 것
    if (doctorSchedules.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No schedule for this date' },
        { status: 400 }
      )
    }

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
      // otherSelectedDates를 Date 배열로 변환 (현재 신청 날짜 제외)
      const pendingSelections = otherSelectedDates
        .filter(d => d !== date) // 현재 날짜 제외
        .map(d => new Date(d))

      console.log('🔍 [submit-v3] 형평성 검증:', {
        currentDate: date,
        otherSelectedDates,
        pendingSelections: pendingSelections.map(d => d.toISOString().split('T')[0])
      })

      const fairnessCheck = await checkDynamicFairness(
        clinicId,
        staffId,
        applicationDate,
        link.year,
        link.month,
        pendingSelections // 다른 선택된 날짜들 전달
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

      // 7-4. ScheduleDoctor에서 requiredStaff 계산 (트랜잭션 내부)
      const doctorSchedulesInTx = await tx.scheduleDoctor.findMany({
        where: {
          date: applicationDate,
          schedule: {
            clinicId,
            year,
            month
          }
        },
        include: {
          doctor: { select: { shortName: true } }
        }
      })

      if (doctorSchedulesInTx.length === 0) {
        throw new Error('No schedule for this date')
      }

      // 원장 조합으로 DoctorCombination 조회
      const doctorShortNames = Array.from(new Set(doctorSchedulesInTx.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctorSchedulesInTx.some(d => d.hasNightShift)

      const combination = await tx.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorShortNames },
          hasNightShift
        }
      })

      if (!combination) {
        throw new Error('해당 원장 조합에 대한 설정을 찾을 수 없습니다')
      }

      // 7-5. 구분별 슬롯 가용성 확인 (원장 조합 설정 기반)
      const departmentCategoryStaff = combination.departmentCategoryStaff as any
      const deptCategories = departmentCategoryStaff[staff.departmentName || '']

      let categoryCheck = {
        canApply: true,
        shouldHold: false,
        message: '신청이 승인되었습니다'
      }

      if (deptCategories && staff.categoryName) {
        const categoryInfo = deptCategories[staff.categoryName]

        if (categoryInfo) {
          const requiredCount = categoryInfo.count || 0
          const minRequired = categoryInfo.minRequired || 0

          // 휴무 가능 인원 = 필요 인원 - 필수 인원
          const maxOffAllowed = requiredCount - minRequired

          // 해당 구분의 현재 신청 수 (CONFIRMED + PENDING)
          const currentApplications = await tx.leaveApplication.count({
            where: {
              date: applicationDate,
              status: { in: ['CONFIRMED', 'PENDING'] },
              staff: {
                clinicId,
                categoryName: staff.categoryName
              }
            }
          })

          // 슬롯 초과 시 보류
          if (currentApplications >= maxOffAllowed) {
            categoryCheck = {
              canApply: true,
              shouldHold: true,
              message: `구분별 슬롯이 부족하여 신청이 보류되었습니다. (최대 ${maxOffAllowed}명, 현재 ${currentApplications}명 신청)`
            }
          }
        }
      }

      // 7-6. 중복 신청 방지 (같은 날짜에 이미 신청했는지)
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
