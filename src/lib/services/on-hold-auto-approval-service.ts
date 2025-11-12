/**
 * ON_HOLD 자동 승인 서비스
 *
 * 스케줄 배치 완료 후, ON_HOLD 상태의 연차 신청들을 검토하여
 * 슬롯이 충분하면 자동으로 CONFIRMED로 변경합니다.
 */

import { prisma } from '@/lib/prisma'
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

      // 3-2. 원장 조합 조회 (scheduleId 통해)
      const schedule = await prisma.schedule.findUnique({
        where: { id: dailySlot.scheduleId },
        include: {
          doctors: {
            include: {
              doctor: { select: { shortName: true } }
            },
            where: {
              date: application.date
            }
          }
        }
      })

      if (!schedule || schedule.doctors.length === 0) {
        console.log(`      ⏭️  SKIP: 스케줄 정보 없음`)
        failedApplications.push({
          id: application.id,
          staffName: application.staff.name || '직원',
          date: application.date,
          reason: '스케줄 정보 없음'
        })
        continue
      }

      const doctorShortNames = Array.from(new Set(schedule.doctors.map(d => d.doctor.shortName))).sort()
      const hasNightShift = schedule.doctors.some(d => d.hasNightShift)

      const combination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: doctorShortNames },
          hasNightShift
        }
      })

      if (!combination) {
        console.log(`      ⏭️  SKIP: 조합 설정 없음`)
        failedApplications.push({
          id: application.id,
          staffName: application.staff.name || '직원',
          date: application.date,
          reason: '조합 설정 없음'
        })
        continue
      }

      // 3-3. 구분별 슬롯 확인
      const departmentCategoryStaff = combination.departmentCategoryStaff as any
      const deptCategories = departmentCategoryStaff[application.staff.departmentName || '']

      let canApprove = true

      if (deptCategories && application.staff.categoryName) {
        const categoryInfo = deptCategories[application.staff.categoryName]

        if (categoryInfo) {
          const requiredCount = categoryInfo.count || 0
          const minRequired = categoryInfo.minRequired || 0
          const maxOffAllowed = requiredCount - minRequired

          // 현재 신청 수 확인
          const currentApplications = await prisma.leaveApplication.count({
            where: {
              date: application.date,
              status: { in: ['CONFIRMED', 'PENDING'] },
              staff: {
                clinicId,
                categoryName: application.staff.categoryName
              }
            }
          })

          if (currentApplications >= maxOffAllowed) {
            canApprove = false
          }
        }
      }

      // 3-4. 승인 가능 여부 판단
      if (canApprove) {
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

  const approvedApplications: AutoApprovalResult['approvedApplications'] = []
  const failedApplications: AutoApprovalResult['failedApplications'] = []

  // 2-2. 원장 조합 조회
  const schedule = await prisma.schedule.findUnique({
    where: { id: dailySlot.scheduleId },
    include: {
      doctors: {
        include: {
          doctor: { select: { shortName: true } }
        },
        where: { date }
      }
    }
  })

  if (!schedule || schedule.doctors.length === 0) {
    console.log(`   ❌ 스케줄 정보 없음`)
    return {
      totalOnHold: onHoldApplications.length,
      approved: 0,
      remainingOnHold: onHoldApplications.length,
      approvedApplications: [],
      failedApplications: onHoldApplications.map(app => ({
        id: app.id,
        staffName: app.staff.name || '직원',
        date: app.date,
        reason: '스케줄 정보 없음'
      }))
    }
  }

  const doctorShortNames = Array.from(new Set(schedule.doctors.map(d => d.doctor.shortName))).sort()
  const hasNightShift = schedule.doctors.some(d => d.hasNightShift)

  const combination = await prisma.doctorCombination.findFirst({
    where: {
      clinicId,
      doctors: { equals: doctorShortNames },
      hasNightShift
    }
  })

  if (!combination) {
    console.log(`   ❌ 조합 설정 없음`)
    return {
      totalOnHold: onHoldApplications.length,
      approved: 0,
      remainingOnHold: onHoldApplications.length,
      approvedApplications: [],
      failedApplications: onHoldApplications.map(app => ({
        id: app.id,
        staffName: app.staff.name || '직원',
        date: app.date,
        reason: '조합 설정 없음'
      }))
    }
  }

  const departmentCategoryStaff = combination.departmentCategoryStaff as any

  // 3. 각 신청 검토
  for (const application of onHoldApplications) {
    try {
      // 슬롯 가용성 확인
      const deptCategories = departmentCategoryStaff[application.staff.departmentName || '']
      let canApprove = true

      if (deptCategories && application.staff.categoryName) {
        const categoryInfo = deptCategories[application.staff.categoryName]

        if (categoryInfo) {
          const requiredCount = categoryInfo.count || 0
          const minRequired = categoryInfo.minRequired || 0
          const maxOffAllowed = requiredCount - minRequired

          const currentApplications = await prisma.leaveApplication.count({
            where: {
              date,
              status: { in: ['CONFIRMED', 'PENDING'] },
              staff: {
                clinicId,
                categoryName: application.staff.categoryName
              }
            }
          })

          if (currentApplications >= maxOffAllowed) {
            canApprove = false
          }
        }
      }

      if (canApprove) {
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
