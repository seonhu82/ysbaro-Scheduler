/**
 * 변경 추적 미들웨어
 *
 * 데이터 변경 시 자동으로 감사 로그 기록
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  auditLogger,
  AuditAction,
  ResourceType,
  SecurityLevel,
  AuditEntry
} from './audit-logger'

/**
 * 변경 추적 미들웨어
 *
 * API 핸들러를 래핑하여 자동으로 변경 사항 추적
 */
export function withChangeTracking(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    resourceType: ResourceType
    getResourceId: (req: NextRequest, result: any) => string
    getOldData?: (req: NextRequest) => Promise<any>
    securityLevel?: SecurityLevel
  }
) {
  const { resourceType, getResourceId, getOldData, securityLevel = SecurityLevel.MEDIUM } = options

  return async (req: NextRequest): Promise<NextResponse> => {
    const method = req.method
    let oldData: any = null

    // UPDATE/DELETE의 경우 기존 데이터 조회
    if ((method === 'PATCH' || method === 'PUT' || method === 'DELETE') && getOldData) {
      oldData = await getOldData(req)
    }

    // 핸들러 실행
    const response = await handler(req)

    // 성공한 요청만 추적
    if (response.ok) {
      try {
        const result = await response.clone().json()

        // 액션 결정
        const action = {
          POST: AuditAction.CREATE,
          PATCH: AuditAction.UPDATE,
          PUT: AuditAction.UPDATE,
          DELETE: AuditAction.DELETE,
          GET: AuditAction.READ
        }[method] as AuditAction

        // 리소스 ID 추출
        const resourceId = getResourceId(req, result)

        // 변경 사항 감지 (UPDATE의 경우)
        let changes = undefined
        if (action === AuditAction.UPDATE && oldData) {
          changes = auditLogger.detectChanges(oldData, result.data || result)
        }

        // 스냅샷 저장 (DELETE의 경우)
        let snapshot = undefined
        if (action === AuditAction.DELETE && oldData) {
          snapshot = oldData
        }

        // 감사 로그 기록
        const clinicId = req.headers.get('x-clinic-id') || 'unknown'
        const userId = req.headers.get('x-user-id') || 'unknown'

        const entry: AuditEntry = {
          actor: {
            id: userId,
            name: req.headers.get('x-user-name') || 'Unknown',
            role: req.headers.get('x-user-role') || 'Unknown'
          },
          action,
          resource: {
            type: resourceType,
            id: resourceId
          },
          changes,
          snapshot,
          securityLevel,
          metadata: {
            ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
            userAgent: req.headers.get('user-agent') || undefined,
            requestId: req.headers.get('x-request-id') || undefined
          }
        }

        await auditLogger.logChange(clinicId, entry)
      } catch (error) {
        console.error('Failed to track changes:', error)
        // 변경 추적 실패는 원래 응답에 영향을 주지 않음
      }
    }

    return response
  }
}

/**
 * 대량 작업 추적
 *
 * 여러 리소스를 한번에 변경하는 작업 추적
 */
export async function trackBulkOperation(
  clinicId: string,
  actor: { id: string; name: string; role: string },
  operation: {
    action: AuditAction
    resourceType: ResourceType
    resourceIds: string[]
    reason?: string
  },
  metadata?: {
    ipAddress?: string
    userAgent?: string
  }
): Promise<void> {
  const { action, resourceType, resourceIds, reason } = operation

  const entry: AuditEntry = {
    actor,
    action,
    resource: {
      type: resourceType,
      id: `bulk-${resourceIds.length}-items`
    },
    reason: reason || `Bulk ${action} operation on ${resourceIds.length} ${resourceType}`,
    securityLevel: SecurityLevel.HIGH, // 대량 작업은 HIGH
    metadata: {
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      requestId: crypto.randomUUID()
    }
  }

  await auditLogger.logChange(clinicId, entry)
}

/**
 * 민감한 데이터 접근 추적
 */
export async function trackSensitiveAccess(
  clinicId: string,
  actor: { id: string; name: string; role: string },
  resource: {
    type: ResourceType
    id: string
    name?: string
  },
  metadata?: {
    ipAddress?: string
    userAgent?: string
    accessReason?: string
  }
): Promise<void> {
  const entry: AuditEntry = {
    actor,
    action: AuditAction.READ,
    resource,
    reason: metadata?.accessReason || 'Sensitive data access',
    securityLevel: SecurityLevel.HIGH,
    metadata: {
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      requestId: crypto.randomUUID()
    }
  }

  await auditLogger.logChange(clinicId, entry)
}

/**
 * 설정 변경 추적
 */
export async function trackSettingsChange(
  clinicId: string,
  actor: { id: string; name: string; role: string },
  settingsType: string,
  oldSettings: any,
  newSettings: any,
  metadata?: {
    ipAddress?: string
    userAgent?: string
  }
): Promise<void> {
  const changes = auditLogger.detectChanges(oldSettings, newSettings)

  const entry: AuditEntry = {
    actor,
    action: AuditAction.UPDATE,
    resource: {
      type: ResourceType.SYSTEM_SETTINGS,
      id: settingsType,
      name: settingsType
    },
    changes,
    reason: 'System settings changed',
    securityLevel: SecurityLevel.CRITICAL, // 시스템 설정은 CRITICAL
    metadata: {
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      requestId: crypto.randomUUID()
    }
  }

  await auditLogger.logChange(clinicId, entry)
}

/**
 * 데이터 내보내기 추적
 */
export async function trackDataExport(
  clinicId: string,
  actor: { id: string; name: string; role: string },
  exportInfo: {
    resourceType: ResourceType
    recordCount: number
    format: string
    filters?: any
  },
  metadata?: {
    ipAddress?: string
    userAgent?: string
  }
): Promise<void> {
  const entry: AuditEntry = {
    actor,
    action: AuditAction.EXPORT,
    resource: {
      type: exportInfo.resourceType,
      id: `export-${exportInfo.recordCount}-records`,
      name: `${exportInfo.recordCount} ${exportInfo.resourceType} records`
    },
    reason: `Exported ${exportInfo.recordCount} records to ${exportInfo.format}`,
    securityLevel: exportInfo.recordCount > 100 ? SecurityLevel.HIGH : SecurityLevel.MEDIUM,
    metadata: {
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      requestId: crypto.randomUUID()
    }
  }

  await auditLogger.logChange(clinicId, entry)
}
