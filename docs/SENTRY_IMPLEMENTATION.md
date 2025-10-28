# Sentry 에러 추적 시스템 구현 완료

## 개요

연세바로치과 스케줄러의 프로덕션 환경에서 발생하는 에러를 실시간으로 추적하고 모니터링하기 위한 Sentry 통합을 완료했습니다.

**구현 날짜**: 2025-10-28
**Provider**: Sentry (SaaS)

## 구현된 시스템

### 1. Sentry 설정 파일

#### 클라이언트 설정 (`sentry.client.config.ts`)
브라우저에서 발생하는 에러 추적:

**주요 기능**:
- ✅ 에러 자동 캡처
- ✅ Session Replay (10% 정상, 100% 에러)
- ✅ 성능 모니터링 (100% 샘플링)
- ✅ 민감 정보 자동 제거
- ✅ 불필요한 에러 필터링

**필터링되는 에러**:
- Hydration 에러 (일반적으로 무해)
- ResizeObserver 에러 (브라우저 이슈)
- 네트워크 에러 (사용자 인터넷 문제)
- Chunk 로딩 실패 (배포 중 발생 가능)

#### 서버 설정 (`sentry.server.config.ts`)
서버에서 발생하는 에러 추적:

**주요 기능**:
- ✅ API 라우트 에러 캡처
- ✅ 데이터베이스 쿼리 추적
- ✅ HTTP 요청 모니터링
- ✅ 민감한 정보 자동 마스킹
- ✅ 성능 최적화 (10% 샘플링)

**민감 정보 보호**:
```typescript
// 자동으로 제거되는 필드
password, token, apiKey, secret, pin,
accessToken, refreshToken, sessionToken

// 마스킹되는 헤더
authorization, cookie, x-api-key
```

### 2. 에러 추적 유틸리티 (`sentry-utils.ts`)

#### 제공하는 기능

**1. 범용 에러 캡처**
```typescript
import { captureError, ErrorSeverity, ErrorCategory } from '@/lib/error-tracking/sentry-utils'

try {
  await riskyOperation()
} catch (error) {
  captureError(error, {
    category: ErrorCategory.DATABASE,
    level: ErrorSeverity.ERROR,
    user: { id: userId, email: userEmail },
    extra: { operation: 'calculateFairness', year: 2024, month: 6 },
    tags: { clinicId: 'clinic-1' }
  })
}
```

**2. 특화된 에러 캡처 함수**

```typescript
// 데이터베이스 에러
captureDatabaseError(error, 'findMany', 'Staff', { query: '...' })

// 배치 작업 에러
captureBatchError(error, clinicId, year, month, weekNumber)

// API 에러
captureAPIError(error, 'POST', '/api/schedule', 500)

// 인증 에러
captureAuthError(error, userId)

// 성능 이슈
capturePerformanceIssue('fairness-calculation', 5500, 5000)
```

**3. Breadcrumbs (이벤트 추적)**
```typescript
import { addBreadcrumb } from '@/lib/error-tracking/sentry-utils'

addBreadcrumb('schedule', 'Started weekly assignment', {
  clinicId,
  year,
  month,
  weekNumber
})

// ... 작업 수행

addBreadcrumb('schedule', 'Completed weekly assignment', {
  assignedStaff: 20,
  duration: '1.5s'
})
```

**4. 성능 트랜잭션**
```typescript
import { withTransaction } from '@/lib/error-tracking/sentry-utils'

const result = await withTransaction(
  'calculate-fairness-stats',
  'fairness.calculation',
  async () => {
    return await calculateFairnessStats(clinicId, year, month)
  }
)
```

**5. 사용자 컨텍스트**
```typescript
import { setUserContext, clearUserContext } from '@/lib/error-tracking/sentry-utils'

// 로그인 시
setUserContext({
  id: user.id,
  email: user.email,
  role: user.role,
  clinicId: user.clinicId
})

// 로그아웃 시
clearUserContext()
```

### 3. API 에러 핸들링 미들웨어 (`with-error-handling.ts`)

#### 자동 에러 추적 래퍼

```typescript
import { withErrorHandling } from '@/lib/error-tracking/with-error-handling'

export const GET = withErrorHandling(async (req) => {
  const data = await fetchData()
  return NextResponse.json({ data })
})

// 에러 발생 시:
// 1. Sentry에 자동 리포트
// 2. 요청 정보 (method, path, query) 포함
// 3. 응답 시간 추적
// 4. 5초 이상 걸린 요청은 별도 경고
```

#### 커스텀 에러 처리

```typescript
import { withCustomErrorHandling } from '@/lib/error-tracking/with-error-handling'

export const POST = withCustomErrorHandling(
  async (req) => {
    // ... 로직
  },
  {
    ValidationError: (error) => {
      return NextResponse.json({ error: error.message }, { status: 400 })
    },
    AuthenticationError: (error) => {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
)
```

#### 안전한 비동기 실행

```typescript
import { safeAsync, parallelSafeAsync } from '@/lib/error-tracking/with-error-handling'

// 단일 작업
const user = await safeAsync(
  () => fetchUser(id),
  null, // fallback
  { operation: 'fetch-user', tags: { userId: id } }
)

// 병렬 작업
const [stats, fairness, attendance] = await parallelSafeAsync([
  () => fetchMonthlyStats(clinicId, year, month),
  () => fetchFairness(clinicId, year, month),
  () => fetchAttendance(clinicId, year, month)
])
```

## 에러 분류 시스템

### 1. 에러 카테고리

```typescript
enum ErrorCategory {
  DATABASE = 'database',              // 데이터베이스 관련
  AUTHENTICATION = 'authentication',  // 인증 관련
  AUTHORIZATION = 'authorization',    // 권한 관련
  VALIDATION = 'validation',          // 입력 검증
  BUSINESS_LOGIC = 'business_logic',  // 비즈니스 로직
  EXTERNAL_API = 'external_api',      // 외부 API
  PERFORMANCE = 'performance',        // 성능 이슈
  UNKNOWN = 'unknown'                 // 미분류
}
```

### 2. 에러 심각도

```typescript
enum ErrorSeverity {
  FATAL = 'fatal',      // 시스템 크래시, 즉시 대응 필요
  ERROR = 'error',      // 일반 에러, 빠른 대응 필요
  WARNING = 'warning',  // 경고, 모니터링 필요
  INFO = 'info',        // 정보성 메시지
  DEBUG = 'debug'       // 디버깅 정보
}
```

### 3. 기능 영역

```typescript
enum FeatureArea {
  SCHEDULE_ASSIGNMENT = 'schedule_assignment',
  LEAVE_APPLICATION = 'leave_application',
  FAIRNESS_CALCULATION = 'fairness_calculation',
  ATTENDANCE_TRACKING = 'attendance_tracking',
  STAFF_MANAGEMENT = 'staff_management',
  AUTHENTICATION = 'authentication',
  API = 'api',
  UI = 'ui'
}
```

## 사용 예시

### 1. 배치 작업에서 사용

```typescript
import { captureBatchError, addBreadcrumb } from '@/lib/error-tracking/sentry-utils'

export async function runWeeklyAssignment(
  clinicId: string,
  year: number,
  month: number,
  weekNumber: number
) {
  addBreadcrumb('batch', 'Starting weekly assignment', {
    clinicId,
    year,
    month,
    weekNumber
  })

  try {
    // 배치 로직 실행
    const result = await assignStaffToWeek(...)

    addBreadcrumb('batch', 'Successfully completed assignment', {
      assignedCount: result.length
    })

    return result
  } catch (error) {
    captureBatchError(error, clinicId, year, month, weekNumber, {
      phase: 'staff_assignment',
      staffCount: 20
    })

    throw error
  }
}
```

### 2. API 라우트에서 사용

```typescript
// src/app/api/schedule/assign/route.ts
import { withErrorHandling } from '@/lib/error-tracking/with-error-handling'

export const POST = withErrorHandling(async (req) => {
  const { clinicId, year, month, weekNumber } = await req.json()

  // 배치 실행
  const result = await runWeeklyAssignment(clinicId, year, month, weekNumber)

  return NextResponse.json({ success: true, data: result })
}, { logRequest: true })
```

### 3. 프론트엔드에서 사용

```typescript
// 클라이언트 컴포넌트
import { captureError, ErrorCategory } from '@/lib/error-tracking/sentry-utils'

async function handleSubmit() {
  try {
    await submitLeaveApplication(data)
  } catch (error) {
    captureError(error, {
      category: ErrorCategory.BUSINESS_LOGIC,
      feature: FeatureArea.LEAVE_APPLICATION,
      extra: {
        staffId: data.staffId,
        date: data.date,
        leaveType: data.leaveType
      }
    })

    toast.error('연차 신청 중 오류가 발생했습니다.')
  }
}
```

## 설정 방법

### 1. 패키지 설치

```bash
npm install --save @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### 2. 환경 변수 설정

```env
# .env.local
SENTRY_DSN=https://your-dsn@sentry.io/project-id
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
RELEASE_VERSION=1.0.0
NEXT_PUBLIC_RELEASE_VERSION=1.0.0
```

### 3. Next.js 설정 추가

```javascript
// next.config.js
const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(
  {
    // 기존 Next.js 설정
  },
  {
    // Sentry 옵션
    silent: true,
    org: 'your-org',
    project: 'dental-scheduler'
  }
)
```

## 알림 설정

### 1. 슬랙 통합

**Critical 에러 (FATAL)**:
- 즉시 슬랙 알림
- #engineering 채널
- @channel 멘션

**일반 에러 (ERROR)**:
- 슬랙 알림 (멘션 없음)
- 업무 시간 내 확인

### 2. 이메일 알림

**일일 리포트**:
- 전날 발생한 모든 에러 요약
- 새로 발생한 이슈
- 해결된 이슈

**주간 리포트**:
- 에러 발생 추세
- 가장 많이 발생한 에러 Top 10
- 해결률, MTTR 통계

## 모니터링 대시보드

### 주요 지표

1. **Error Rate**: 시간당 에러 발생률
2. **MTTR**: 평균 문제 해결 시간
3. **Affected Users**: 영향받은 사용자 수
4. **Release Health**: 릴리즈별 안정성

### 커스텀 대시보드

- 배치 작업 성공률
- API 응답 시간 분포
- 데이터베이스 쿼리 성능
- 에러 카테고리별 분포

## 보안 고려사항

### 자동으로 제거되는 민감 정보

```typescript
// 요청 데이터
password, token, apiKey, secret, pin,
accessToken, refreshToken, sessionToken

// HTTP 헤더
authorization, cookie, x-api-key

// URL 파라미터
?token=xxx → ?token=[REDACTED]
```

### 사용자 정보 보호

```typescript
// ✅ 안전
{ id: 'user-123', role: 'ADMIN', clinic_id: 'clinic-1' }

// ❌ 위험 (절대 포함하지 않음)
{ ssn: '123-45-6789', phoneNumber: '010-1234-5678' }
```

## 생성된 파일

```
sentry.client.config.ts                    # 클라이언트 설정
sentry.server.config.ts                    # 서버 설정

src/lib/error-tracking/
  ├── sentry-utils.ts                      # 에러 추적 유틸리티
  └── with-error-handling.ts               # API 미들웨어

docs/
  ├── SENTRY_ERROR_TRACKING.md             # 전략 가이드
  └── SENTRY_IMPLEMENTATION.md             # 이 문서
```

## 베스트 프랙티스

### 1. 의미 있는 에러 메시지

```typescript
// ❌ 나쁨
throw new Error('Error')

// ✅ 좋음
throw new Error(`Failed to assign staff ${staffId} to week ${weekNumber} in ${year}-${month}`)
```

### 2. 충분한 컨텍스트

```typescript
// ✅ 좋음
captureError(error, {
  extra: {
    staffId,
    year,
    month,
    weekNumber,
    currentAssignments: assignments.length,
    availableSlots: slots.length
  }
})
```

### 3. Breadcrumbs 활용

```typescript
addBreadcrumb('calculation', 'Started fairness calculation')
addBreadcrumb('calculation', 'Loaded staff data', { count: 20 })
addBreadcrumb('calculation', 'Calculated scores')
// ... 에러 발생 시 모든 breadcrumb가 함께 전송됨
```

## 다음 단계

### 완료된 작업 (28/30)
1. ✅ **에러 추적 시스템 (Sentry)** (이번 작업)

### 남은 작업 (2개)
1. ⏭️ **성능 모니터링 대시보드 구축**
2. ⏭️ **감사 로그 시스템 강화**

## 참고 자료

- [SENTRY_ERROR_TRACKING.md](./SENTRY_ERROR_TRACKING.md)
- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)

## 결론

Sentry 에러 추적 시스템을 성공적으로 구현하여 프로덕션 환경의 모든 에러를 실시간으로 추적할 수 있게 되었습니다.

**주요 달성 사항**:
- ✅ 클라이언트/서버 통합 완료
- ✅ 민감 정보 자동 보호
- ✅ 자동 에러 분류 시스템
- ✅ API 라우트 자동 추적
- ✅ 성능 모니터링 준비 완료

이제 프로덕션에서 발생하는 모든 문제를 즉시 파악하고 대응할 수 있습니다! 🎯
