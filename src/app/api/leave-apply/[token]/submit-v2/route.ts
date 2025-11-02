/**
 * 연차/오프 신청 API V2
 * - 연차/오프 별도 형평성 기준 적용 (60점 vs 75점)
 * - 슬롯 오버플로우 자동 거절
 * - 명확한 거절/보류 사유 메시지
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCategoryAvailability } from '@/lib/services/category-slot-service'
import { calculateStaffFairnessV2, canApplyLeaveType } from '@/lib/services/fairness-calculator-v2'
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
    const year = applicationDate.getFullYear()
    const month = applicationDate.getMonth() + 1

    // 3. 형평성 점수 계산 (V2 - 사용자 지정 공식)
    const fairnessScore = await calculateStaffFairnessV2(staffId, clinicId, year, month)

    // 4. 연차/오프에 따른 승인 가능 여부 확인
    const fairnessCheck = canApplyLeaveType(fairnessScore, type)

    if (!fairnessCheck.canApply) {
      // 형평성 부족으로 자동 거절
      return NextResponse.json({
        success: false,
        error: fairnessCheck.reason,
        statusType: 'REJECTED',
        details: {
          currentScore: fairnessScore.overallScore,
          requiredScore: type === 'ANNUAL' ? 60 : 75,
          leaveType: type === 'ANNUAL' ? '연차' : '오프'
        }
      }, { status: 400 })
    }

    // 5-6. 🔒 트랜잭션: 슬롯 확인 및 신청 생성
    const newApplication = await prisma.$transaction(async (tx) => {
      // 5-1. 중복 신청 방지
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

      // 5-2. 같은 카테고리의 현재 신청 수 (CONFIRMED + PENDING + ON_HOLD)
      const sameCategory = await tx.staff.findMany({
        where: {
          clinicId,
          categoryName: staff.categoryName,
          isActive: true
        },
        select: { id: true }
      })

      const totalStaffInCategory = sameCategory.length

      const categoryApplications = await tx.leaveApplication.count({
        where: {
          date: applicationDate,
          status: { in: ['CONFIRMED', 'PENDING', 'ON_HOLD'] },
          staff: {
            clinicId,
            categoryName: staff.categoryName
          }
        }
      })

      // 5-3. 슬롯 가용성 확인
      const categoryCheck = await checkCategoryAvailability(
        clinicId,
        applicationDate,
        0, // requiredStaff는 내부에서 계산됨
        staff.categoryName || ''
      )

      // 5-4. 슬롯 오버플로우 체크 (예: 토요일 4번 중 이미 3명 신청 → 거절)
      // 필요 인력을 계산
      const dailySlot = await tx.dailySlot.findFirst({
        where: {
          date: applicationDate,
          week: { clinicId }
        }
      })

      let totalRequiredForCategory = 0
      if (dailySlot && dailySlot.departmentCategoryStaff) {
        const categoryStaff = dailySlot.departmentCategoryStaff as Record<string, Record<string, { count: number; minRequired?: number }>>
        for (const dept in categoryStaff) {
          const categories = categoryStaff[dept]
          if (categories[staff.categoryName || '']) {
            totalRequiredForCategory += categories[staff.categoryName || ''].count
          }
        }
      }

      // 최대 가능 신청 수 = 총 인력 - 필요 인력
      const maxPossibleApplications = Math.max(0, totalStaffInCategory - totalRequiredForCategory)

      // 이미 최대치를 초과하면 거절
      if (categoryApplications >= maxPossibleApplications) {
        // 거절 처리
        const application = await tx.leaveApplication.create({
          data: {
            clinicId,
            staffId,
            date: applicationDate,
            leaveType: type,
            status: 'REJECTED',
            holdReason: null,
            linkId: link.id
            // rejectionReason: `${staff.categoryName || '해당 구분'}의 ${type === 'ANNUAL' ? '연차' : '오프'} 신청이 최대 인원(${maxPossibleApplications}명)을 초과했습니다. 이미 ${categoryApplications}명이 신청했습니다.` // 스키마 업데이트 후 활성화
          }
        })

        throw new Error(`SLOT_OVERFLOW:${staff.categoryName || '해당 구분'}의 ${type === 'ANNUAL' ? '연차' : '오프'} 신청이 최대 인원(${maxPossibleApplications}명)을 초과했습니다. 이미 ${categoryApplications}명이 신청했습니다.`)
      }

      // 6. 신청 생성
      let status: 'PENDING' | 'ON_HOLD' = 'PENDING'
      let holdReason: string | null = null

      if (categoryCheck.shouldHold) {
        status = 'ON_HOLD'
        holdReason = `⏳ 보류 - ${categoryCheck.message || '형평성 기준 미달로 대기 중입니다.'} 스케줄 확정 후 재검토됩니다.`
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

      console.log(`✅ ${type === 'ANNUAL' ? '연차' : '오프'} 신청 완료: ${staff.name} (${applicationDate.toISOString().split('T')[0]}) - ${status}`)

      return application
    }, {
      isolationLevel: 'Serializable'
    })

    // 🔔 알림 전송
    try {
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
        ? newApplication.holdReason || '보류되었습니다.'
        : `${type === 'ANNUAL' ? '연차' : '오프'} 신청이 완료되었습니다.`,
      details: {
        fairnessScore: fairnessScore.overallScore,
        leaveType: type === 'ANNUAL' ? '연차' : '오프'
      }
    })

  } catch (error: any) {
    console.error('Leave application error:', error)

    // 중복 신청 에러
    if (error.message === 'DUPLICATE_APPLICATION') {
      return NextResponse.json(
        {
          success: false,
          error: '이미 해당 날짜에 신청하셨습니다.',
          statusType: 'DUPLICATE'
        },
        { status: 409 }
      )
    }

    // 슬롯 오버플로우 에러
    if (error.message.startsWith('SLOT_OVERFLOW:')) {
      const reason = error.message.replace('SLOT_OVERFLOW:', '')
      return NextResponse.json(
        {
          success: false,
          error: `❌ 거절 - ${reason}`,
          statusType: 'REJECTED',
          reason
        },
        { status: 400 }
      )
    }

    // 동시성 에러
    if (error.code === 'P2034') {
      return NextResponse.json(
        {
          success: false,
          error: '동시에 여러 신청이 발생했습니다. 잠시 후 다시 시도해주세요.',
          statusType: 'CONFLICT'
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
