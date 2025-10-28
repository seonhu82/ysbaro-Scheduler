/**
 * Sentry 에러 추적 유틸리티
 *
 * 에러를 Sentry에 리포트하고 적절한 컨텍스트를 추가하는 헬퍼 함수들
 */

import * as Sentry from '@sentry/nextjs'

/**
 * 에러 심각도 레벨
 */
export enum ErrorSeverity {
  FATAL = 'fatal', // 시스템 크래시
  ERROR = 'error', // 일반 에러
  WARNING = 'warning', // 경고
  INFO = 'info', // 정보
  DEBUG = 'debug' // 디버그
}

/**
 * 에러 카테고리
 */
export enum ErrorCategory {
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_API = 'external_api',
  PERFORMANCE = 'performance',
  UNKNOWN = 'unknown'
}

/**
 * 기능 영역
 */
export enum FeatureArea {
  SCHEDULE_ASSIGNMENT = 'schedule_assignment',
  LEAVE_APPLICATION = 'leave_application',
  FAIRNESS_CALCULATION = 'fairness_calculation',
  ATTENDANCE_TRACKING = 'attendance_tracking',
  STAFF_MANAGEMENT = 'staff_management',
  AUTHENTICATION = 'authentication',
  API = 'api',
  UI = 'ui'
}

interface ErrorContext {
  user?: {
    id: string
    email?: string
    role?: string
    clinicId?: string
  }
  extra?: Record<string, any>
  tags?: Record<string, string>
  level?: ErrorSeverity
  category?: ErrorCategory
  feature?: FeatureArea
  fingerprint?: string[]
}

/**
 * 에러를 Sentry에 캡처
 *
 * @param error - 캡처할 에러 객체
 * @param context - 추가 컨텍스트 정보
 */
export function captureError(error: Error | unknown, context?: ErrorContext): string | undefined {
  // 프로덕션 환경이 아니면 콘솔에만 출력
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Error:', error)
    if (context) {
      console.error('   Context:', context)
    }
    return undefined
  }

  return Sentry.withScope(scope => {
    // 사용자 정보 설정
    if (context?.user) {
      scope.setUser({
        id: context.user.id,
        email: context.user.email,
        role: context.user.role,
        clinic_id: context.user.clinicId
      })
    }

    // 태그 설정
    if (context?.tags) {
      scope.setTags(context.tags)
    }

    // 카테고리 태그
    if (context?.category) {
      scope.setTag('error_category', context.category)
    }

    // 기능 영역 태그
    if (context?.feature) {
      scope.setTag('feature', context.feature)
    }

    // 추가 데이터
    if (context?.extra) {
      scope.setExtras(context.extra)
    }

    // 심각도 레벨
    if (context?.level) {
      scope.setLevel(context.level)
    }

    // 에러 그룹화를 위한 fingerprint
    if (context?.fingerprint) {
      scope.setFingerprint(context.fingerprint)
    }

    // 에러 캡처
    if (error instanceof Error) {
      return Sentry.captureException(error)
    } else {
      return Sentry.captureMessage(String(error), context?.level || ErrorSeverity.ERROR)
    }
  })
}

/**
 * 데이터베이스 에러 캡처
 */
export function captureDatabaseError(
  error: Error,
  operation: string,
  table?: string,
  extra?: Record<string, any>
) {
  return captureError(error, {
    category: ErrorCategory.DATABASE,
    tags: {
      db_operation: operation,
      ...(table && { db_table: table })
    },
    extra,
    level: ErrorSeverity.ERROR,
    fingerprint: ['database-error', operation, table || 'unknown']
  })
}

/**
 * 배치 작업 에러 캡처
 */
export function captureBatchError(
  error: Error,
  clinicId: string,
  year: number,
  month: number,
  weekNumber?: number,
  extra?: Record<string, any>
) {
  return captureError(error, {
    category: ErrorCategory.BUSINESS_LOGIC,
    feature: FeatureArea.SCHEDULE_ASSIGNMENT,
    tags: {
      clinic_id: clinicId,
      year: String(year),
      month: String(month),
      ...(weekNumber && { week_number: String(weekNumber) })
    },
    extra,
    level: ErrorSeverity.FATAL,
    fingerprint: ['batch-error', clinicId, String(year), String(month)]
  })
}

/**
 * API 에러 캡처
 */
export function captureAPIError(
  error: Error,
  method: string,
  path: string,
  statusCode?: number,
  extra?: Record<string, any>
) {
  return captureError(error, {
    category: ErrorCategory.EXTERNAL_API,
    feature: FeatureArea.API,
    tags: {
      api_method: method,
      api_path: path,
      ...(statusCode && { status_code: String(statusCode) })
    },
    extra,
    level: statusCode && statusCode >= 500 ? ErrorSeverity.ERROR : ErrorSeverity.WARNING
  })
}

/**
 * 인증 에러 캡처
 */
export function captureAuthError(error: Error, userId?: string, extra?: Record<string, any>) {
  return captureError(error, {
    category: ErrorCategory.AUTHENTICATION,
    feature: FeatureArea.AUTHENTICATION,
    tags: {
      ...(userId && { user_id: userId })
    },
    extra,
    level: ErrorSeverity.WARNING,
    fingerprint: ['auth-error', userId || 'unknown']
  })
}

/**
 * 성능 이슈 캡처
 */
export function capturePerformanceIssue(
  operation: string,
  duration: number,
  threshold: number,
  extra?: Record<string, any>
) {
  return captureError(new Error(`Slow operation: ${operation} took ${duration}ms`), {
    category: ErrorCategory.PERFORMANCE,
    tags: {
      operation,
      duration: String(duration),
      threshold: String(threshold)
    },
    extra,
    level: ErrorSeverity.WARNING,
    fingerprint: ['performance-issue', operation]
  })
}

/**
 * Breadcrumb 추가
 *
 * 에러 발생 전 맥락을 제공하는 이벤트 추적
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level,
      timestamp: Date.now() / 1000
    })
  } else {
    console.log(`🍞 Breadcrumb [${category}]: ${message}`, data || '')
  }
}

/**
 * 성능 트랜잭션 시작
 */
export function startTransaction(name: string, op: string, description?: string) {
  if (process.env.NODE_ENV !== 'production') {
    return {
      finish: () => {},
      startChild: () => ({
        finish: () => {},
        setData: () => {}
      })
    }
  }

  return Sentry.startTransaction({
    name,
    op,
    description
  })
}

/**
 * 트랜잭션 래퍼
 *
 * 함수 실행을 트랜잭션으로 감싸서 성능 추적
 */
export async function withTransaction<T>(
  name: string,
  op: string,
  fn: () => Promise<T>
): Promise<T> {
  const transaction = startTransaction(name, op)

  try {
    const result = await fn()
    transaction.finish()
    return result
  } catch (error) {
    captureError(error as Error, {
      extra: { transaction_name: name, operation: op }
    })
    transaction.finish()
    throw error
  }
}

/**
 * 사용자 컨텍스트 설정
 */
export function setUserContext(user: {
  id: string
  email?: string
  role?: string
  clinicId?: string
}) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
      clinic_id: user.clinicId
    })
  }
}

/**
 * 사용자 컨텍스트 초기화
 */
export function clearUserContext() {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setUser(null)
  }
}

/**
 * 커스텀 컨텍스트 설정
 */
export function setContext(name: string, context: Record<string, any>) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setContext(name, context)
  }
}

/**
 * 태그 설정
 */
export function setTag(key: string, value: string) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setTag(key, value)
  }
}

/**
 * 여러 태그 일괄 설정
 */
export function setTags(tags: Record<string, string>) {
  if (process.env.NODE_ENV === 'production') {
    Sentry.setTags(tags)
  }
}
