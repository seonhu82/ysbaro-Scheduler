/**
 * 알림 생성 헬퍼 함수
 * - 중복 코드 제거
 * - 일관된 알림 생성
 */

import { prisma } from '@/lib/prisma'
import type { NotificationType } from '@prisma/client'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  relatedId?: string
  metadata?: Record<string, any>
}

/**
 * 알림 생성 (중복 방지 포함)
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    // 최근 5분 이내 동일한 알림이 있는지 확인 (중복 방지)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        createdAt: { gte: fiveMinutesAgo }
      }
    })

    if (existingNotification) {
      console.log(`⏭️ 중복 알림 방지: ${params.title}`)
      return existingNotification
    }

    // 새 알림 생성
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedId: params.relatedId,
        metadata: params.metadata as any,
        isRead: false
      }
    })

    console.log(`📬 알림 생성: ${params.title} → ${params.userId}`)

    return notification
  } catch (error) {
    console.error('알림 생성 실패:', error)
    // 알림 생성 실패는 무시 (주요 기능에 영향 없음)
    return null
  }
}

/**
 * 여러 사용자에게 알림 생성
 */
export async function createBulkNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  const notifications = await Promise.allSettled(
    userIds.map(userId => createNotification({ ...params, userId }))
  )

  const successCount = notifications.filter(r => r.status === 'fulfilled').length
  console.log(`📬 대량 알림 생성: ${successCount}/${userIds.length}명`)

  return notifications
}

/**
 * 연차 신청 알림
 */
export async function notifyLeaveApplication(
  staffId: string,
  staffName: string,
  date: Date,
  type: 'ANNUAL' | 'OFF',
  adminUserIds: string[]
) {
  const dateStr = date.toLocaleDateString('ko-KR')
  const typeStr = type === 'ANNUAL' ? '연차' : '오프'

  return createBulkNotifications(adminUserIds, {
    type: 'LEAVE_SUBMITTED',
    title: `${typeStr} 신청`,
    message: `${staffName}님이 ${dateStr} ${typeStr}를 신청했습니다.`,
    relatedId: staffId,
    metadata: { staffId, date: date.toISOString(), leaveType: type }
  })
}

/**
 * 연차 승인 알림
 */
export async function notifyLeaveApproved(
  userId: string,
  staffName: string,
  date: Date,
  type: 'ANNUAL' | 'OFF'
) {
  const dateStr = date.toLocaleDateString('ko-KR')
  const typeStr = type === 'ANNUAL' ? '연차' : '오프'

  return createNotification({
    userId,
    type: 'LEAVE_CONFIRMED',
    title: `${typeStr} 승인`,
    message: `${dateStr} ${typeStr}가 승인되었습니다.`,
    metadata: { date: date.toISOString(), leaveType: type }
  })
}

/**
 * 연차 거절 알림
 */
export async function notifyLeaveRejected(
  userId: string,
  staffName: string,
  date: Date,
  type: 'ANNUAL' | 'OFF',
  reason?: string
) {
  const dateStr = date.toLocaleDateString('ko-KR')
  const typeStr = type === 'ANNUAL' ? '연차' : '오프'

  return createNotification({
    userId,
    type: 'LEAVE_REJECTED',
    title: `${typeStr} 거절`,
    message: `${dateStr} ${typeStr}가 거절되었습니다.${reason ? ` 사유: ${reason}` : ''}`,
    metadata: { date: date.toISOString(), leaveType: type, reason }
  })
}

/**
 * 스케줄 배포 알림
 */
export async function notifyScheduleDeployed(
  userIds: string[],
  year: number,
  month: number
) {
  return createBulkNotifications(userIds, {
    type: 'SCHEDULE_DEPLOYED',
    title: '스케줄 배포',
    message: `${year}년 ${month}월 스케줄이 배포되었습니다.`,
    metadata: { year, month }
  })
}

/**
 * 재배치 알림
 */
export async function notifyReassignment(
  affectedStaffUserIds: string[],
  reason: string,
  date: Date
) {
  const dateStr = date.toLocaleDateString('ko-KR')

  return createBulkNotifications(affectedStaffUserIds, {
    type: 'SCHEDULE_CHANGED',
    title: '스케줄 변경',
    message: `${dateStr} 스케줄이 변경되었습니다. 사유: ${reason}`,
    metadata: { date: date.toISOString(), reason }
  })
}

/**
 * 형평성 임계값 초과 알림
 */
export async function notifyFairnessThresholdExceeded(
  adminUserIds: string[],
  staffName: string,
  fairnessType: string,
  count: number,
  threshold: number
) {
  return createBulkNotifications(adminUserIds, {
    type: 'FAIRNESS_ISSUE',
    title: '형평성 임계값 초과',
    message: `${staffName}님의 ${fairnessType} 근무가 ${count}회로 임계값(${threshold}회)을 초과했습니다.`,
    metadata: { staffName, fairnessType, count, threshold }
  })
}

/**
 * 배치 완료 알림
 */
export async function notifyAssignmentComplete(
  adminUserIds: string[],
  weekInfoId: string,
  assignedCount: number,
  unresolvedCount: number
) {
  const status = unresolvedCount === 0 ? '성공' : `경고 (미해결 ${unresolvedCount}건)`

  return createBulkNotifications(adminUserIds, {
    type: 'WEEKLY_ASSIGNMENT_COMPLETE',
    title: `주간 배치 완료 - ${status}`,
    message: `${assignedCount}명 배치 완료${unresolvedCount > 0 ? `, ${unresolvedCount}건 미해결` : ''}`,
    relatedId: weekInfoId,
    metadata: { weekInfoId, assignedCount, unresolvedCount }
  })
}

/**
 * 출퇴근 의심 건 알림
 */
export async function notifySuspiciousAttendance(
  adminUserIds: string[],
  staffName: string,
  reason: string
) {
  return createBulkNotifications(adminUserIds, {
    type: 'SUSPICIOUS_ATTENDANCE',
    title: '출퇴근 의심 건',
    message: `${staffName}님의 출퇴근에 의심스러운 패턴이 감지되었습니다: ${reason}`,
    metadata: { staffName, reason }
  })
}
