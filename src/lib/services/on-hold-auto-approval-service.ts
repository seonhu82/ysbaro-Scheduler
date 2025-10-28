/**
 * ON_HOLD 자동 승인 서비스
 *
 * 스케줄 배치 완료 후, ON_HOLD 상태의 연차 신청들을 검토하여
 * 슬롯이 충분하면 자동으로 CONFIRMED로 변경합니다.
 */

import { prisma } from '@/lib/prisma'
import { checkCategoryAvailability } from './category-slot-service'
import { notifyLeaveApproved } from './notification-helper'
import { logOnHoldAutoApproved } from './activity-log-service'

export interface AutoApprovalResult {
  totalOnHold: number
  approved: number
  remainingOnHold: number
  approvedApplications: Array<{
    id: string
    staffName: string
    date: Date
    reason: string
  }>
  failedApplications: Array<{
    id: string
    staffName: string
    date: Date
    reason: string
  }>
}

/**
 * 주간 배치 완료 후 ON_HOLD 신청들 자동 승인 처리
 */
export async function processOnHoldAutoApproval(
  weekInfoId: string
): Promise<AutoApprovalResult> {
  console.log(`\n🔄 ON_HOLD 자동 승인 처리 시작: ${weekInfoId}`)

  // 1. WeekInfo 조회
  const weekInfo = await prisma.weekInfo.findUnique({
    where: { id: weekInfoId },
    include: {
      dailySlots: {
        orderBy: { date: 'asc' }
      }
    }
  })

  if (!weekInfo) {
    throw new Error('WeekInfo를 찾을 수 없습니다')
  }

  const clinicId = weekInfo.clinicId

  // 2. 해당 주차의 ON_HOLD 신청 조회
  const onHoldApplications = await prisma.leaveApplication.findMany({
    where: {
      clinicId,
      status: 'ON_HOLD',
      date: {
        gte: weekInfo.weekStart,
        lte: weekInfo.weekEnd
      }
    },
    include: {
      staff: {
        include: {
          user: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc' // 먼저 신청한 순서대로 처리
    }
  })

  console.log(`   📋 ON_HOLD 신청: ${onHoldApplications.length}건`)

  if (onHoldApplications.length === 0) {
    return {
      totalOnHold: 0,
      approved: 0,
      remainingOnHold: 0,
      approvedApplications: [],
      failedApplications: []
    }
  }

  const approvedApplications: AutoApprovalResult['approvedApplications'] = []
  const failedApplications: AutoApprovalResult['failedApplications'] = []

  // 3. 각 신청에 대해 슬롯 가용성 재확인
  for (const application of onHoldApplications) {
    try {
      console.log(`\n   🔍 검토 중: ${application.staff.name} (${application.date.toISOString().split('T')[0]})`)

      // 3-1. DailySlot 조회
      const dailySlot = await prisma.dailySlot.findFirst({
        where: {
          date: application.date,
          weekId: weekInfoId
        }
      })

      if (!dailySlot) {
        console.log(`      ❌ DailySlot을 찾을 수 없음`)
        failedApplications.push({
          id: application.id,
          staffName: application.staff.name || '직원',
          date: application.date,
          reason: 'DailySlot을 찾을 수 없음'
        })
        continue
      }

      const requiredStaff = dailySlot.requiredStaff

      // 3-2. 현재 신청 수 (CONFIRMED + PENDING) 카운트
      const currentApplications = await prisma.leaveApplication.count({
        where: {
          date: application.date,
          status: { in: ['CONFIRMED', 'PENDING'] },
          staff: { clinicId }
        }
      })

      // 3-3. 구분별 신청 수 카운트
      const categoryApplications = await prisma.leaveApplication.count({
        where: {
          date: application.date,
          status: { in: ['CONFIRMED', 'PENDING'] },
          staff: {
            clinicId,
            categoryName: application.staff.categoryName
          }
        }
      })

      // 3-4. 슬롯 가용성 확인
      const categoryCheck = await checkCategoryAvailability(
        clinicId,
        application.date,
        requiredStaff,
        application.staff.categoryName || '',
        prisma
      )

      // 3-5. 승인 가능 여부 판단
      if (!categoryCheck.shouldHold) {
        // 승인 가능!
        await prisma.leaveApplication.update({
          where: { id: application.id },
          data: {
            status: 'CONFIRMED',
            holdReason: null
          }
        })

        console.log(`      ✅ 자동 승인 완료`)

        approvedApplications.push({
          id: application.id,
          staffName: application.staff.name || '직원',
          date: application.date,
          reason: '슬롯 확보됨'
        })

        // 🔔 승인 알림 전송
        try {
          if (application.staff.user) {
            await notifyLeaveApproved(
              application.staff.user.id,
              application.staff.name || '직원',
              application.date,
              application.leaveType
            )
          }
        } catch (notificationError) {
          console.error('알림 전송 실패 (무시):', notificationError)
        }
      } else {
        // 여전히 슬롯 부족
        console.log(`      ⏳ 여전히 보류: ${categoryCheck.message}`)
        failedApplications.push({
          id: application.id,
          staffName: application.staff.name || '직원',
          date: application.date,
          reason: categoryCheck.message
        })
      }
    } catch (error: any) {
      console.error(`      ❌ 처리 실패: ${error.message}`)
      failedApplications.push({
        id: application.id,
        staffName: application.staff.name || '직원',
        date: application.date,
        reason: `처리 실패: ${error.message}`
      })
    }
  }

  const result: AutoApprovalResult = {
    totalOnHold: onHoldApplications.length,
    approved: approvedApplications.length,
    remainingOnHold: failedApplications.length,
    approvedApplications,
    failedApplications
  }

  console.log(`\n✅ ON_HOLD 자동 승인 완료:`)
  console.log(`   총 ${result.totalOnHold}건 중 ${result.approved}건 승인, ${result.remainingOnHold}건 보류 유지`)

  // 🆕 활동 로그: ON_HOLD 자동 승인
  if (result.approved > 0) {
    await logOnHoldAutoApproved(
      clinicId,
      result.approved,
      result.approvedApplications.map(a => a.staffName)
    )
  }

  return result
}

/**
 * 특정 날짜의 ON_HOLD 신청들 자동 승인 처리
 * (재배치 후 호출)
 */
export async function processOnHoldForDate(
  clinicId: string,
  date: Date
): Promise<AutoApprovalResult> {
  console.log(`\n🔄 특정 날짜 ON_HOLD 자동 승인 처리: ${date.toISOString().split('T')[0]}`)

  // 1. 해당 날짜의 ON_HOLD 신청 조회
  const onHoldApplications = await prisma.leaveApplication.findMany({
    where: {
      clinicId,
      status: 'ON_HOLD',
      date
    },
    include: {
      staff: {
        include: {
          user: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  })

  console.log(`   📋 ON_HOLD 신청: ${onHoldApplications.length}건`)

  if (onHoldApplications.length === 0) {
    return {
      totalOnHold: 0,
      approved: 0,
      remainingOnHold: 0,
      approvedApplications: [],
      failedApplications: []
    }
  }

  // 2. DailySlot 조회
  const dailySlot = await prisma.dailySlot.findFirst({
    where: {
      date,
      week: { clinicId }
    }
  })

  if (!dailySlot) {
    console.log(`   ❌ DailySlot을 찾을 수 없음`)
    return {
      totalOnHold: onHoldApplications.length,
      approved: 0,
      remainingOnHold: onHoldApplications.length,
      approvedApplications: [],
      failedApplications: onHoldApplications.map(app => ({
        id: app.id,
        staffName: app.staff.name || '직원',
        date: app.date,
        reason: 'DailySlot을 찾을 수 없음'
      }))
    }
  }

  const requiredStaff = dailySlot.requiredStaff
  const approvedApplications: AutoApprovalResult['approvedApplications'] = []
  const failedApplications: AutoApprovalResult['failedApplications'] = []

  // 3. 각 신청 검토
  for (const application of onHoldApplications) {
    try {
      // 슬롯 가용성 확인
      const categoryCheck = await checkCategoryAvailability(
        clinicId,
        date,
        requiredStaff,
        application.staff.categoryName || '',
        prisma
      )

      if (!categoryCheck.shouldHold) {
        // 승인 가능
        await prisma.leaveApplication.update({
          where: { id: application.id },
          data: {
            status: 'CONFIRMED',
            holdReason: null
          }
        })

        console.log(`   ✅ 자동 승인: ${application.staff.name}`)

        approvedApplications.push({
          id: application.id,
          staffName: application.staff.name || '직원',
          date: application.date,
          reason: '슬롯 확보됨'
        })

        // 알림 전송
        try {
          if (application.staff.user) {
            await notifyLeaveApproved(
              application.staff.user.id,
              application.staff.name || '직원',
              application.date,
              application.leaveType
            )
          }
        } catch (notificationError) {
          console.error('알림 전송 실패 (무시):', notificationError)
        }
      } else {
        console.log(`   ⏳ 보류 유지: ${application.staff.name} - ${categoryCheck.message}`)
        failedApplications.push({
          id: application.id,
          staffName: application.staff.name || '직원',
          date: application.date,
          reason: categoryCheck.message
        })
      }
    } catch (error: any) {
      console.error(`   ❌ 처리 실패: ${error.message}`)
      failedApplications.push({
        id: application.id,
        staffName: application.staff.name || '직원',
        date: application.date,
        reason: `처리 실패: ${error.message}`
      })
    }
  }

  const result: AutoApprovalResult = {
    totalOnHold: onHoldApplications.length,
    approved: approvedApplications.length,
    remainingOnHold: failedApplications.length,
    approvedApplications,
    failedApplications
  }

  console.log(`\n✅ 날짜별 ON_HOLD 자동 승인 완료:`)
  console.log(`   총 ${result.totalOnHold}건 중 ${result.approved}건 승인, ${result.remainingOnHold}건 보류 유지`)

  return result
}
