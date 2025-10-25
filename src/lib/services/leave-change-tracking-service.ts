/**
 * 연차/오프 변경 추적 및 재배치 서비스
 *
 * 연차/오프 신청 상태가 변경될 때 영향받는 주차를 추적하고
 * 필요 시 자동으로 재배치를 수행합니다.
 */

import { prisma } from '@/lib/prisma'
import { createWeeklyAssignmentBackup } from './assignment-backup-service'
import { autoAssignWeeklySchedule } from '@/lib/algorithms/weekly-assign-v2'

/**
 * 연차/오프 변경 로그 생성
 *
 * @param leaveApplicationId - 연차/오프 신청 ID
 * @param changeType - 변경 타입
 * @param oldStatus - 변경 전 상태
 * @param newStatus - 변경 후 상태
 * @param oldDate - 변경 전 날짜
 * @param newDate - 변경 후 날짜
 * @param createdBy - 변경자 ID
 */
export async function logLeaveChange(params: {
  leaveApplicationId: string
  changeType: 'STATUS_CHANGE' | 'DATE_CHANGE' | 'DELETION'
  oldStatus?: string
  newStatus?: string
  oldDate?: Date
  newDate?: Date
  createdBy?: string
}): Promise<string> {
  const { leaveApplicationId, changeType, oldStatus, newStatus, oldDate, newDate, createdBy } = params

  console.log(`\n📝 연차/오프 변경 로그 생성: ${changeType}`)

  // 연차/오프 신청 정보 조회
  const leaveApp = await prisma.leaveApplication.findUnique({
    where: { id: leaveApplicationId },
    include: {
      staff: { select: { id: true, name: true } },
      clinic: { select: { id: true } }
    }
  })

  if (!leaveApp) {
    throw new Error('연차/오프 신청을 찾을 수 없습니다')
  }

  // 영향받는 주차 확인
  const affectedDates: Date[] = []

  if (changeType === 'DATE_CHANGE') {
    if (oldDate) affectedDates.push(oldDate)
    if (newDate) affectedDates.push(newDate)
  } else if (changeType === 'STATUS_CHANGE') {
    // 상태 변경: PENDING → CONFIRMED 또는 CONFIRMED → REJECTED/CANCELLED
    affectedDates.push(leaveApp.date)
  } else if (changeType === 'DELETION') {
    affectedDates.push(leaveApp.date)
  }

  // 각 날짜가 속한 주차 찾기
  const affectedWeekIds: string[] = []

  for (const date of affectedDates) {
    const weekInfo = await prisma.weekInfo.findFirst({
      where: {
        clinicId: leaveApp.clinicId,
        weekStart: { lte: date },
        weekEnd: { gte: date }
      },
      select: { id: true }
    })

    if (weekInfo && !affectedWeekIds.includes(weekInfo.id)) {
      affectedWeekIds.push(weekInfo.id)
    }
  }

  // 재배치 필요 여부 판단
  const requiresReassignment = determineReassignmentNeed(
    changeType,
    oldStatus,
    newStatus
  )

  // 변경 로그 생성
  const changeLog = await prisma.leaveChangeLog.create({
    data: {
      leaveApplicationId,
      changeType,
      oldStatus,
      newStatus,
      oldDate,
      newDate,
      affectedWeekIds,
      requiresReassignment,
      createdBy
    }
  })

  console.log(`   ✅ 변경 로그 생성 완료`)
  console.log(`      - 변경 타입: ${changeType}`)
  console.log(`      - 영향받는 주차: ${affectedWeekIds.length}개`)
  console.log(`      - 재배치 필요: ${requiresReassignment ? '예' : '아니오'}`)

  return changeLog.id
}

/**
 * 재배치 필요 여부 판단
 *
 * @param changeType - 변경 타입
 * @param oldStatus - 변경 전 상태
 * @param newStatus - 변경 후 상태
 * @returns 재배치 필요 여부
 */
function determineReassignmentNeed(
  changeType: string,
  oldStatus?: string,
  newStatus?: string
): boolean {
  // 날짜 변경 → 항상 재배치 필요
  if (changeType === 'DATE_CHANGE') return true

  // 삭제 → 재배치 필요 (CONFIRMED 상태였다면)
  if (changeType === 'DELETION') return true

  // 상태 변경
  if (changeType === 'STATUS_CHANGE') {
    // PENDING → CONFIRMED: 재배치 필요 (새로운 제외 인원 발생)
    if (oldStatus === 'PENDING' && newStatus === 'CONFIRMED') return true

    // CONFIRMED → REJECTED/CANCELLED: 재배치 필요 (제외 인원 해제)
    if (oldStatus === 'CONFIRMED' && (newStatus === 'REJECTED' || newStatus === 'CANCELLED')) {
      return true
    }

    // PENDING → REJECTED/CANCELLED: 재배치 불필요
    if (oldStatus === 'PENDING' && (newStatus === 'REJECTED' || newStatus === 'CANCELLED')) {
      return false
    }
  }

  return false
}

/**
 * 미처리 재배치 로그 조회
 *
 * @param clinicId - 병원 ID (선택)
 * @returns 재배치 필요 로그 목록
 */
export async function getPendingReassignments(clinicId?: string) {
  const where: any = {
    requiresReassignment: true,
    reassignedAt: null
  }

  if (clinicId) {
    where.leaveApplication = { clinicId }
  }

  return await prisma.leaveChangeLog.findMany({
    where,
    include: {
      leaveApplication: {
        include: {
          staff: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  })
}

/**
 * 영향받는 주차의 자동 재배치 실행
 *
 * @param changeLogId - 변경 로그 ID
 * @param performedBy - 실행자 ID
 * @returns 재배치 결과
 */
export async function performAutoReassignment(
  changeLogId: string,
  performedBy?: string
): Promise<{
  success: boolean
  message: string
  results: Array<{
    weekInfoId: string
    success: boolean
    message: string
  }>
}> {
  console.log(`\n🔄 자동 재배치 실행 시작...`)

  const changeLog = await prisma.leaveChangeLog.findUnique({
    where: { id: changeLogId },
    include: {
      leaveApplication: {
        include: {
          staff: { select: { name: true } }
        }
      }
    }
  })

  if (!changeLog) {
    throw new Error('변경 로그를 찾을 수 없습니다')
  }

  console.log(`   변경 사유: ${changeLog.changeType}`)
  console.log(`   직원: ${changeLog.leaveApplication.staff.name}`)
  console.log(`   영향받는 주차: ${changeLog.affectedWeekIds.length}개`)

  const results: Array<{
    weekInfoId: string
    success: boolean
    message: string
  }> = []

  for (const weekInfoId of changeLog.affectedWeekIds) {
    try {
      console.log(`\n   📅 ${weekInfoId} 재배치 중...`)

      // 1. 재배치 전 백업 생성
      await createWeeklyAssignmentBackup(
        weekInfoId,
        'BEFORE_LEAVE_CHANGE',
        `연차/오프 변경으로 인한 자동 재배치 전 백업 (변경 로그: ${changeLogId})`,
        performedBy
      )

      // 2. 재배치 실행
      const result = await autoAssignWeeklySchedule(weekInfoId)

      results.push({
        weekInfoId,
        success: result.success,
        message: result.message
      })

      console.log(`   ${result.success ? '✅' : '⚠️'} ${result.message}`)
    } catch (error: any) {
      console.error(`   ❌ 재배치 실패: ${error.message}`)

      results.push({
        weekInfoId,
        success: false,
        message: `재배치 실패: ${error.message}`
      })
    }
  }

  // 변경 로그 업데이트
  await prisma.leaveChangeLog.update({
    where: { id: changeLogId },
    data: {
      reassignedAt: new Date(),
      reassignedBy: performedBy
    }
  })

  const successCount = results.filter(r => r.success).length
  const failCount = results.length - successCount

  const message = `재배치 완료: 성공 ${successCount}개, 실패 ${failCount}개`

  console.log(`\n✅ ${message}`)

  return {
    success: failCount === 0,
    message,
    results
  }
}

/**
 * 연차/오프 변경 시 자동 재배치 트리거
 *
 * LeaveApplication 업데이트 시 호출됩니다.
 *
 * @param leaveApplicationId - 연차/오프 신청 ID
 * @param changeType - 변경 타입
 * @param oldData - 변경 전 데이터
 * @param newData - 변경 후 데이터
 * @param userId - 변경자 ID
 * @param autoReassign - 자동 재배치 실행 여부 (기본 true)
 */
export async function handleLeaveChange(params: {
  leaveApplicationId: string
  changeType: 'STATUS_CHANGE' | 'DATE_CHANGE' | 'DELETION'
  oldData?: { status?: string; date?: Date }
  newData?: { status?: string; date?: Date }
  userId?: string
  autoReassign?: boolean
}): Promise<{
  changeLogId: string
  reassignmentTriggered: boolean
  reassignmentResults?: any
}> {
  const { leaveApplicationId, changeType, oldData, newData, userId, autoReassign = true } = params

  // 1. 변경 로그 생성
  const changeLogId = await logLeaveChange({
    leaveApplicationId,
    changeType,
    oldStatus: oldData?.status,
    newStatus: newData?.status,
    oldDate: oldData?.date,
    newDate: newData?.date,
    createdBy: userId
  })

  // 2. 자동 재배치 실행 여부 확인
  const changeLog = await prisma.leaveChangeLog.findUnique({
    where: { id: changeLogId }
  })

  if (!changeLog || !changeLog.requiresReassignment || !autoReassign) {
    return {
      changeLogId,
      reassignmentTriggered: false
    }
  }

  // 3. 자동 재배치 실행
  const reassignmentResults = await performAutoReassignment(changeLogId, userId)

  return {
    changeLogId,
    reassignmentTriggered: true,
    reassignmentResults
  }
}
