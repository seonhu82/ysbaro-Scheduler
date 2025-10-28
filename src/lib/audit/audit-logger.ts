/**
 * 강화된 감사 로그 시스템
 *
 * 변경 추적, 보안 이벤트, 규정 준수를 위한 포괄적인 감사 로그
 */

import { prisma } from '@/lib/db'
import { ActivityType } from '@prisma/client'
import crypto from 'crypto'

/**
 * 보안 이벤트 타입
 */
export enum SecurityEventType {
  // 인증
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',

  // 권한
  ROLE_CHANGED = 'ROLE_CHANGED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_REACTIVATED = 'ACCOUNT_REACTIVATED',

  // 민감한 작업
  SENSITIVE_DATA_ACCESSED = 'SENSITIVE_DATA_ACCESSED',
  BULK_EXPORT = 'BULK_EXPORT',
  BULK_DELETE = 'BULK_DELETE',
  SYSTEM_SETTINGS_CHANGED = 'SYSTEM_SETTINGS_CHANGED',

  // 비정상 활동
  SUSPICIOUS_ACTIVITY_DETECTED = 'SUSPICIOUS_ACTIVITY_DETECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT'
}

/**
 * 감사 액션
 */
export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT'
}

/**
 * 리소스 타입
 */
export enum ResourceType {
  USER = 'User',
  STAFF = 'Staff',
  SCHEDULE = 'Schedule',
  LEAVE_APPLICATION = 'LeaveApplication',
  ATTENDANCE = 'AttendanceRecord',
  FAIRNESS_SETTINGS = 'FairnessSettings',
  SYSTEM_SETTINGS = 'SystemSettings'
}

/**
 * 보안 레벨
 */
export enum SecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * 변경 사항
 */
export interface FieldChange {
  field: string
  oldValue: any
  newValue: any
}

/**
 * 감사 엔트리
 */
export interface AuditEntry {
  actor: {
    id: string
    name: string
    role: string
  }
  action: AuditAction
  resource: {
    type: ResourceType
    id: string
    name?: string
  }
  changes?: FieldChange[]
  snapshot?: any
  reason?: string
  securityLevel: SecurityLevel
  metadata: {
    ipAddress?: string
    userAgent?: string
    requestId?: string
    sessionId?: string
  }
}

/**
 * 보안 이벤트
 */
export interface SecurityEvent {
  type: SecurityEventType
  severity: SecurityLevel
  actor?: {
    id?: string
    name?: string
    ipAddress?: string
  }
  details: Record<string, any>
  metadata: {
    ipAddress?: string
    userAgent?: string
    timestamp: Date
  }
}

/**
 * 감사 로그 클래스
 */
class AuditLogger {
  /**
   * 변경 추적 로그 기록
   */
  async logChange(clinicId: string, entry: AuditEntry): Promise<void> {
    try {
      const { actor, action, resource, changes, snapshot, reason, securityLevel, metadata } = entry

      // ActivityLog에 저장
      await prisma.activityLog.create({
        data: {
          clinicId,
          userId: actor.id,
          activityType: this.mapActionToActivityType(action, resource.type),
          description: this.generateDescription(action, resource, changes),
          metadata: {
            action,
            resource,
            changes,
            snapshot,
            reason,
            securityLevel,
            actor,
            ...metadata
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      })

      // Critical 이벤트는 별도 알림
      if (securityLevel === SecurityLevel.CRITICAL) {
        await this.sendCriticalAlert(entry)
      }
    } catch (error) {
      console.error('Failed to log audit entry:', error)
      // 감사 로그 실패는 심각한 문제이므로 에러를 다시 던짐
      throw error
    }
  }

  /**
   * 보안 이벤트 로그 기록
   */
  async logSecurityEvent(clinicId: string, event: SecurityEvent): Promise<void> {
    try {
      const { type, severity, actor, details, metadata } = event

      await prisma.activityLog.create({
        data: {
          clinicId,
          userId: actor?.id,
          activityType: this.mapSecurityEventToActivityType(type),
          description: this.generateSecurityDescription(type, details),
          metadata: {
            securityEvent: type,
            severity,
            actor,
            details,
            timestamp: metadata.timestamp
          },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent
        }
      })

      // Critical/High 보안 이벤트는 즉시 알림
      if (severity === SecurityLevel.CRITICAL || severity === SecurityLevel.HIGH) {
        await this.sendSecurityAlert(event)
      }
    } catch (error) {
      console.error('Failed to log security event:', error)
      throw error
    }
  }

  /**
   * 변경 사항 감지 (객체 비교)
   */
  detectChanges(oldData: any, newData: any): FieldChange[] {
    const changes: FieldChange[] = []

    // 모든 키를 확인
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])

    for (const key of allKeys) {
      // 시스템 필드는 제외
      if (['id', 'createdAt', 'updatedAt'].includes(key)) continue

      const oldValue = oldData?.[key]
      const newValue = newData?.[key]

      // 값이 다르면 변경으로 기록
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: key,
          oldValue: this.sanitizeValue(oldValue),
          newValue: this.sanitizeValue(newValue)
        })
      }
    }

    return changes
  }

  /**
   * 민감한 데이터 마스킹
   */
  private sanitizeValue(value: any): any {
    if (value === null || value === undefined) return value

    // 민감한 필드 마스킹
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'pin']

    if (typeof value === 'object') {
      const sanitized = { ...value }
      for (const key in sanitized) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          sanitized[key] = '[REDACTED]'
        } else if (typeof sanitized[key] === 'object') {
          sanitized[key] = this.sanitizeValue(sanitized[key])
        }
      }
      return sanitized
    }

    return value
  }

  /**
   * 액션을 ActivityType으로 매핑
   */
  private mapActionToActivityType(action: AuditAction, resourceType: ResourceType): ActivityType {
    const mappings: Record<string, ActivityType> = {
      'CREATE-User': ActivityType.USER_LOGIN, // 가장 가까운 타입 사용
      'UPDATE-User': ActivityType.USER_ROLE_CHANGED,
      'CREATE-LeaveApplication': ActivityType.LEAVE_APPLICATION_CREATED,
      'UPDATE-LeaveApplication': ActivityType.LEAVE_APPLICATION_STATUS_CHANGED,
      'CREATE-Schedule': ActivityType.SCHEDULE_ASSIGNED,
      'DELETE-Schedule': ActivityType.SCHEDULE_CHANGED
      // ... 더 많은 매핑 추가
    }

    const key = `${action}-${resourceType}`
    return mappings[key] || ActivityType.SYSTEM_EVENT
  }

  /**
   * 보안 이벤트를 ActivityType으로 매핑
   */
  private mapSecurityEventToActivityType(event: SecurityEventType): ActivityType {
    const mappings: Record<SecurityEventType, ActivityType> = {
      [SecurityEventType.LOGIN_SUCCESS]: ActivityType.USER_LOGIN,
      [SecurityEventType.LOGIN_FAILED]: ActivityType.USER_LOGIN,
      [SecurityEventType.LOGOUT]: ActivityType.USER_LOGOUT,
      [SecurityEventType.ROLE_CHANGED]: ActivityType.USER_ROLE_CHANGED,
      [SecurityEventType.ACCOUNT_SUSPENDED]: ActivityType.USER_SUSPENDED,
      // ... 더 많은 매핑 추가
      [SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.SUSPICIOUS_ACTIVITY_DETECTED]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.PASSWORD_CHANGED]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.PASSWORD_RESET_REQUESTED]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.PASSWORD_RESET_COMPLETED]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.PERMISSION_GRANTED]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.PERMISSION_REVOKED]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.ACCOUNT_REACTIVATED]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.SENSITIVE_DATA_ACCESSED]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.BULK_EXPORT]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.BULK_DELETE]: ActivityType.SYSTEM_EVENT,
      [SecurityEventType.SYSTEM_SETTINGS_CHANGED]: ActivityType.SETTINGS_CHANGED,
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: ActivityType.SYSTEM_EVENT
    }

    return mappings[event] || ActivityType.SYSTEM_EVENT
  }

  /**
   * 설명 생성
   */
  private generateDescription(
    action: AuditAction,
    resource: { type: ResourceType; id: string; name?: string },
    changes?: FieldChange[]
  ): string {
    const resourceName = resource.name || resource.id
    const actionText = {
      [AuditAction.CREATE]: '생성',
      [AuditAction.READ]: '조회',
      [AuditAction.UPDATE]: '수정',
      [AuditAction.DELETE]: '삭제',
      [AuditAction.EXPORT]: '내보내기',
      [AuditAction.IMPORT]: '가져오기'
    }[action]

    let description = `${resource.type} ${resourceName}을(를) ${actionText}함`

    if (changes && changes.length > 0) {
      const changesSummary = changes
        .map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`)
        .join(', ')
      description += ` (변경: ${changesSummary})`
    }

    return description
  }

  /**
   * 보안 이벤트 설명 생성
   */
  private generateSecurityDescription(
    type: SecurityEventType,
    details: Record<string, any>
  ): string {
    const descriptions: Record<SecurityEventType, string> = {
      [SecurityEventType.LOGIN_SUCCESS]: '로그인 성공',
      [SecurityEventType.LOGIN_FAILED]: '로그인 실패',
      [SecurityEventType.LOGOUT]: '로그아웃',
      [SecurityEventType.PASSWORD_CHANGED]: '비밀번호 변경',
      [SecurityEventType.PASSWORD_RESET_REQUESTED]: '비밀번호 재설정 요청',
      [SecurityEventType.PASSWORD_RESET_COMPLETED]: '비밀번호 재설정 완료',
      [SecurityEventType.ROLE_CHANGED]: '권한 변경',
      [SecurityEventType.PERMISSION_GRANTED]: '권한 부여',
      [SecurityEventType.PERMISSION_REVOKED]: '권한 회수',
      [SecurityEventType.ACCOUNT_SUSPENDED]: '계정 정지',
      [SecurityEventType.ACCOUNT_REACTIVATED]: '계정 재활성화',
      [SecurityEventType.SENSITIVE_DATA_ACCESSED]: '민감한 데이터 접근',
      [SecurityEventType.BULK_EXPORT]: '대량 데이터 내보내기',
      [SecurityEventType.BULK_DELETE]: '대량 삭제',
      [SecurityEventType.SYSTEM_SETTINGS_CHANGED]: '시스템 설정 변경',
      [SecurityEventType.SUSPICIOUS_ACTIVITY_DETECTED]: '의심스러운 활동 감지',
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: 'Rate Limit 초과',
      [SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT]: '무단 접근 시도'
    }

    let description = descriptions[type] || type

    // 상세 정보 추가
    if (details.reason) {
      description += ` - ${details.reason}`
    }

    return description
  }

  /**
   * Critical 알림 전송
   */
  private async sendCriticalAlert(entry: AuditEntry): Promise<void> {
    console.error('🚨 CRITICAL AUDIT EVENT:', {
      actor: entry.actor,
      action: entry.action,
      resource: entry.resource,
      reason: entry.reason
    })

    // 실제 구현: 슬랙/이메일 알림
  }

  /**
   * 보안 알림 전송
   */
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    console.error('⚠️ SECURITY EVENT:', {
      type: event.type,
      severity: event.severity,
      actor: event.actor,
      details: event.details
    })

    // 실제 구현: 슬랙/이메일 알림
  }

  /**
   * 감사 로그 검색
   */
  async searchAuditLogs(query: {
    clinicId: string
    userId?: string
    activityTypes?: ActivityType[]
    dateRange?: { from: Date; to: Date }
    searchText?: string
    limit?: number
    offset?: number
  }): Promise<any[]> {
    const { clinicId, userId, activityTypes, dateRange, searchText, limit = 50, offset = 0 } = query

    const where: any = { clinicId }

    if (userId) where.userId = userId
    if (activityTypes) where.activityType = { in: activityTypes }
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.from,
        lte: dateRange.to
      }
    }
    if (searchText) {
      where.description = { contains: searchText }
    }

    return prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
  }

  /**
   * 사용자 활동 리포트 생성
   */
  async generateUserActivityReport(
    userId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<any> {
    const activities = await prisma.activityLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const summary = {
      totalActivities: activities.length,
      byType: {} as Record<string, number>,
      timeline: activities.slice(0, 100) // 최근 100개
    }

    activities.forEach(activity => {
      summary.byType[activity.activityType] = (summary.byType[activity.activityType] || 0) + 1
    })

    return summary
  }
}

// 싱글톤 인스턴스
export const auditLogger = new AuditLogger()

/**
 * 편의 함수
 */
export const logChange = (clinicId: string, entry: AuditEntry) =>
  auditLogger.logChange(clinicId, entry)
export const logSecurityEvent = (clinicId: string, event: SecurityEvent) =>
  auditLogger.logSecurityEvent(clinicId, event)
export const detectChanges = (oldData: any, newData: any) => auditLogger.detectChanges(oldData, newData)
export const searchAuditLogs = (query: any) => auditLogger.searchAuditLogs(query)
export const generateUserActivityReport = (userId: string, dateRange: { from: Date; to: Date }) =>
  auditLogger.generateUserActivityReport(userId, dateRange)
