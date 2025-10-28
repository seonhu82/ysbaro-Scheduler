/**
 * 활동 로그 서비스
 *
 * 주요 이벤트를 ActivityLog에 기록하여 감사 추적(audit trail)을 제공합니다.
 */

import { prisma } from '@/lib/prisma'
import { ActivityType } from '@prisma/client'

export interface CreateActivityLogParams {
  clinicId: string
  userId?: string
  activityType: ActivityType
  description: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * 활동 로그 생성
 */
export async function createActivityLog(params: CreateActivityLogParams) {
  try {
    const log = await prisma.activityLog.create({
      data: {
        clinicId: params.clinicId,
        userId: params.userId,
        activityType: params.activityType,
        description: params.description,
        metadata: params.metadata as any,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent
      }
    })

    console.log(`📝 Activity Log: ${params.activityType} - ${params.description}`)

    return log
  } catch (error) {
    console.error('Activity log creation failed:', error)
    // 로그 생성 실패는 무시 (주요 기능에 영향 없음)
    return null
  }
}

/**
 * 주간 배치 시작 로그
 */
export async function logWeeklyAssignmentStarted(
  clinicId: string,
  weekInfoId: string,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'WEEKLY_ASSIGNMENT_STARTED',
    description: '주간 자동 배치 시작',
    metadata: { weekInfoId }
  })
}

/**
 * 주간 배치 완료 로그
 */
export async function logWeeklyAssignmentCompleted(
  clinicId: string,
  weekInfoId: string,
  assignedCount: number,
  unresolvedCount: number,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'WEEKLY_ASSIGNMENT_COMPLETED',
    description: `주간 배치 완료: ${assignedCount}명 배치, ${unresolvedCount}건 미해결`,
    metadata: {
      weekInfoId,
      assignedCount,
      unresolvedCount
    }
  })
}

/**
 * 주간 배치 실패 로그
 */
export async function logWeeklyAssignmentFailed(
  clinicId: string,
  weekInfoId: string,
  error: string,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'WEEKLY_ASSIGNMENT_FAILED',
    description: `주간 배치 실패: ${error}`,
    metadata: {
      weekInfoId,
      error
    }
  })
}

/**
 * 재배치 트리거 로그
 */
export async function logReassignmentTriggered(
  clinicId: string,
  reason: string,
  affectedWeekIds: string[],
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'REASSIGNMENT_TRIGGERED',
    description: `재배치 트리거: ${reason}`,
    metadata: {
      reason,
      affectedWeekIds,
      affectedWeekCount: affectedWeekIds.length
    }
  })
}

/**
 * 재배치 완료 로그
 */
export async function logReassignmentCompleted(
  clinicId: string,
  successCount: number,
  failCount: number,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'REASSIGNMENT_COMPLETED',
    description: `재배치 완료: 성공 ${successCount}건, 실패 ${failCount}건`,
    metadata: {
      successCount,
      failCount
    }
  })
}

/**
 * ON_HOLD 자동 승인 로그
 */
export async function logOnHoldAutoApproved(
  clinicId: string,
  approvedCount: number,
  staffNames: string[],
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'ONHOLD_AUTO_APPROVED',
    description: `ON_HOLD 자동 승인: ${approvedCount}건 (${staffNames.join(', ')})`,
    metadata: {
      approvedCount,
      staffNames
    }
  })
}

/**
 * 연차 신청 로그
 */
export async function logLeaveSubmitted(
  clinicId: string,
  staffName: string,
  date: Date,
  leaveType: string,
  status: string
) {
  return createActivityLog({
    clinicId,
    activityType: 'LEAVE_SUBMITTED',
    description: `${staffName}님 ${leaveType} 신청 (${date.toISOString().split('T')[0]}) - ${status}`,
    metadata: {
      staffName,
      date: date.toISOString(),
      leaveType,
      status
    }
  })
}

/**
 * 연차 승인 로그
 */
export async function logLeaveConfirmed(
  clinicId: string,
  staffName: string,
  date: Date,
  leaveType: string,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'LEAVE_CONFIRMED',
    description: `${staffName}님 ${leaveType} 승인 (${date.toISOString().split('T')[0]})`,
    metadata: {
      staffName,
      date: date.toISOString(),
      leaveType
    }
  })
}

/**
 * 연차 거절 로그
 */
export async function logLeaveRejected(
  clinicId: string,
  staffName: string,
  date: Date,
  leaveType: string,
  reason?: string,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'LEAVE_REJECTED',
    description: `${staffName}님 ${leaveType} 거절 (${date.toISOString().split('T')[0]})${reason ? `: ${reason}` : ''}`,
    metadata: {
      staffName,
      date: date.toISOString(),
      leaveType,
      reason
    }
  })
}

/**
 * 출퇴근 체크 로그
 */
export async function logAttendanceChecked(
  clinicId: string,
  staffName: string,
  checkType: 'IN' | 'OUT',
  isScheduled: boolean,
  isSuspicious: boolean
) {
  return createActivityLog({
    clinicId,
    activityType: isSuspicious ? 'ATTENDANCE_SUSPICIOUS' : 'ATTENDANCE_CHECKED',
    description: `${staffName}님 ${checkType === 'IN' ? '출근' : '퇴근'}${!isScheduled ? ' (스케줄 외)' : ''}${isSuspicious ? ' ⚠️ 의심' : ''}`,
    metadata: {
      staffName,
      checkType,
      isScheduled,
      isSuspicious
    }
  })
}

/**
 * 백업 생성 로그
 */
export async function logBackupCreated(
  clinicId: string,
  weekInfoId: string,
  backupType: string,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'BACKUP_CREATED',
    description: `백업 생성: ${backupType}`,
    metadata: {
      weekInfoId,
      backupType
    }
  })
}

/**
 * 백업 복원 로그
 */
export async function logBackupRestored(
  clinicId: string,
  weekInfoId: string,
  backupId: string,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'BACKUP_RESTORED',
    description: `백업 복원`,
    metadata: {
      weekInfoId,
      backupId
    }
  })
}

/**
 * 직원 생성 로그
 */
export async function logStaffCreated(
  clinicId: string,
  staffName: string,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'STAFF_CREATED',
    description: `직원 추가: ${staffName}`,
    metadata: {
      staffName
    }
  })
}

/**
 * 직원 수정 로그
 */
export async function logStaffUpdated(
  clinicId: string,
  staffName: string,
  changes: string[],
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'STAFF_UPDATED',
    description: `직원 수정: ${staffName} (${changes.join(', ')})`,
    metadata: {
      staffName,
      changes
    }
  })
}

/**
 * 직원 삭제 로그
 */
export async function logStaffDeleted(
  clinicId: string,
  staffName: string,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'STAFF_DELETED',
    description: `직원 삭제: ${staffName}`,
    metadata: {
      staffName
    }
  })
}

/**
 * 설정 변경 로그
 */
export async function logSettingsUpdated(
  clinicId: string,
  settingType: string,
  changes: Record<string, any>,
  userId?: string
) {
  return createActivityLog({
    clinicId,
    userId,
    activityType: 'SETTINGS_UPDATED',
    description: `설정 변경: ${settingType}`,
    metadata: {
      settingType,
      changes
    }
  })
}
