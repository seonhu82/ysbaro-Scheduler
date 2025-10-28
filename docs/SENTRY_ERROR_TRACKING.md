# Sentry 에러 추적 시스템

## 개요

연세바로치과 스케줄러의 프로덕션 환경에서 발생하는 에러를 실시간으로 추적하고 모니터링하기 위한 Sentry 통합 가이드입니다.

## Sentry란?

Sentry는 애플리케이션의 에러와 성능 이슈를 실시간으로 추적하고 분석하는 플랫폼입니다.

**주요 기능**:
- 🔍 **에러 추적**: 모든 예외와 에러 자동 캡처
- 📊 **성능 모니터링**: API 응답 시간, DB 쿼리 성능 추적
- 🔔 **실시간 알림**: 슬랙, 이메일 등으로 즉시 알림
- 📈 **트렌드 분석**: 에러 발생 패턴 분석
- 🐛 **디버깅 정보**: Stack trace, 사용자 컨텍스트, breadcrumbs

## 통합 전략

### 1. 추적할 에러 유형

#### 높은 우선순위 (Critical)
- 데이터베이스 연결 실패
- 인증/인가 에러
- 결제/중요 트랜잭션 실패
- 배치 작업 실패
- API 서버 크래시

#### 중간 우선순위 (Error)
- 비즈니스 로직 예외
- 외부 API 호출 실패
- 파일 업로드/다운로드 실패
- 이메일 전송 실패

#### 낮은 우선순위 (Warning)
- 입력 검증 실패 (일부)
- 캐시 미스
- Rate limit 도달

### 2. 추적하지 않을 것

- 정상적인 검증 에러 (400 Bad Request)
- 권한 없음 (403 Forbidden) - 로그만 기록
- 리소스 없음 (404 Not Found)
- 사용자 입력 오류

### 3. 환경별 설정

| 환경 | Sentry 활성화 | Sample Rate | Replay 활성화 |
|------|--------------|-------------|--------------|
| Production | ✅ | 100% | ✅ (10%) |
| Staging | ✅ | 100% | ✅ (50%) |
| Development | ❌ | 0% | ❌ |
| Test | ❌ | 0% | ❌ |

## 구현 계획

### 1. Next.js 통합

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // 성능 모니터링
  tracesSampleRate: 1.0,

  // Session Replay (사용자 세션 녹화)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // 에러 필터링
  beforeSend(event, hint) {
    // 특정 에러 무시
    if (event.exception?.values?.[0]?.type === 'ValidationError') {
      return null
    }
    return event
  }
})
```

### 2. 서버 사이드 통합

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,

  // 추가 컨텍스트
  beforeSend(event) {
    // 민감한 정보 제거
    if (event.request?.data) {
      delete event.request.data.password
      delete event.request.data.token
    }
    return event
  }
})
```

### 3. 커스텀 에러 핸들러

```typescript
// lib/error-handler.ts
import * as Sentry from '@sentry/nextjs'

export function captureError(
  error: Error,
  context?: {
    user?: { id: string; email: string }
    extra?: Record<string, any>
    tags?: Record<string, string>
  }
) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(error)
    return
  }

  Sentry.withScope(scope => {
    if (context?.user) {
      scope.setUser(context.user)
    }

    if (context?.extra) {
      scope.setExtras(context.extra)
    }

    if (context?.tags) {
      scope.setTags(context.tags)
    }

    Sentry.captureException(error)
  })
}
```

### 4. API 라우트 에러 래퍼

```typescript
// lib/with-error-handling.ts
import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export function withErrorHandling(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      return await handler(req)
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          api_route: req.nextUrl.pathname,
          method: req.method
        },
        extra: {
          url: req.url,
          headers: Object.fromEntries(req.headers)
        }
      })

      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      )
    }
  }
}
```

## 에러 분류 (Tags)

### 1. 에러 타입별 태그

```typescript
Sentry.setTag('error_type', 'database')
Sentry.setTag('error_type', 'validation')
Sentry.setTag('error_type', 'authentication')
Sentry.setTag('error_type', 'business_logic')
Sentry.setTag('error_type', 'external_api')
```

### 2. 기능별 태그

```typescript
Sentry.setTag('feature', 'schedule_assignment')
Sentry.setTag('feature', 'leave_application')
Sentry.setTag('feature', 'fairness_calculation')
Sentry.setTag('feature', 'attendance_tracking')
```

### 3. 사용자 정보

```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
  role: user.role,
  clinicId: user.clinicId
})
```

### 4. 추가 컨텍스트

```typescript
Sentry.setContext('schedule', {
  year: 2024,
  month: 6,
  weekNumber: 2
})

Sentry.setContext('performance', {
  dbQueryTime: '150ms',
  cacheHitRate: '95%'
})
```

## 알림 설정

### 1. 슬랙 통합

**Critical 에러**:
- 즉시 슬랙 알림
- @channel 멘션
- 30분 이내 응답 필요

**Error**:
- 슬랙 알림 (멘션 없음)
- 업무 시간 내 확인

**Warning**:
- 일일 요약 리포트

### 2. 이메일 알림

**Critical 에러**:
- 담당자 즉시 이메일
- SMS 백업 (선택)

**주간 리포트**:
- 전체 에러 통계
- 주요 이슈 요약
- 해결된 이슈 목록

## 성능 모니터링

### 1. API 성능 추적

```typescript
import * as Sentry from '@sentry/nextjs'

const transaction = Sentry.startTransaction({
  name: 'GET /api/stats/fairness',
  op: 'http.server'
})

const span = transaction.startChild({
  op: 'db.query',
  description: 'Load fairness statistics'
})

// ... 데이터베이스 쿼리

span.finish()
transaction.finish()
```

### 2. 데이터베이스 쿼리 추적

```typescript
// Prisma 미들웨어
prisma.$use(async (params, next) => {
  const span = Sentry.startChild({
    op: 'db.query',
    description: `${params.model}.${params.action}`
  })

  const result = await next(params)

  span.setData('query', params)
  span.finish()

  return result
})
```

### 3. 외부 API 호출 추적

```typescript
const span = transaction.startChild({
  op: 'http.client',
  description: 'Fetch holiday data'
})

try {
  const response = await fetch(url)
  span.setHttpStatus(response.status)
} finally {
  span.finish()
}
```

## 에러 우선순위 및 대응

### 🔴 Critical (P0)
**예시**: 데이터베이스 연결 실패, 서버 크래시

**대응**:
- 즉시 슬랙 알림
- 30분 이내 초기 대응
- 1시간 이내 근본 원인 파악

### 🟠 High (P1)
**예시**: 배치 작업 실패, 결제 에러

**대응**:
- 슬랙 알림
- 2시간 이내 대응
- 당일 해결

### 🟡 Medium (P2)
**예시**: 이메일 전송 실패, 캐시 에러

**대응**:
- 로그 기록
- 1-2일 이내 검토
- 주간 스프린트에 포함

### 🟢 Low (P3)
**예시**: 사용자 입력 검증 실패

**대응**:
- 통계 수집
- 월간 리뷰
- 패턴 분석

## 보안 고려사항

### 1. 민감한 정보 제거

```typescript
beforeSend(event) {
  // 비밀번호, 토큰 등 제거
  if (event.request?.data) {
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret']
    sensitiveFields.forEach(field => {
      delete event.request.data[field]
    })
  }

  // 쿼리 파라미터에서 토큰 제거
  if (event.request?.url) {
    event.request.url = event.request.url.replace(/token=[^&]+/, 'token=[REDACTED]')
  }

  return event
}
```

### 2. 사용자 개인정보 보호

```typescript
Sentry.setUser({
  id: user.id, // OK
  email: hashEmail(user.email), // 해시 처리
  // 주민번호, 전화번호 등은 절대 포함하지 않음
})
```

## 모니터링 대시보드

### 1. 주요 지표

- **Error Rate**: 시간당 에러 발생률
- **MTTR** (Mean Time To Resolution): 평균 해결 시간
- **Affected Users**: 영향받은 사용자 수
- **Issue Frequency**: 이슈 발생 빈도

### 2. 커스텀 대시보드

- 배치 작업 실패율
- API 응답 시간 분포
- 데이터베이스 쿼리 성능
- 캐시 히트율

## 베스트 프랙티스

### 1. 의미 있는 에러 메시지

```typescript
// ❌ 나쁨
throw new Error('Error')

// ✅ 좋음
throw new Error('Failed to calculate fairness score for staff ${staffId} in ${year}-${month}')
```

### 2. 컨텍스트 추가

```typescript
// ✅ 좋음
Sentry.withScope(scope => {
  scope.setContext('calculation', {
    staffId,
    year,
    month,
    previousScore: 85
  })
  Sentry.captureException(error)
})
```

### 3. Breadcrumbs 활용

```typescript
Sentry.addBreadcrumb({
  category: 'schedule',
  message: 'Started weekly assignment',
  level: 'info',
  data: { clinicId, year, month, weekNumber }
})

// ... 작업 수행

Sentry.addBreadcrumb({
  category: 'schedule',
  message: 'Completed weekly assignment',
  level: 'info'
})
```

### 4. 에러 그룹화

```typescript
// fingerprint로 유사한 에러 그룹화
Sentry.captureException(error, {
  fingerprint: ['database-timeout', tableName]
})
```

## 비용 최적화

### 1. Sample Rate 조정

```typescript
// 프로덕션: 모든 에러 추적
tracesSampleRate: 1.0

// 성능 추적은 샘플링
tracePropagationTargets: [/^https:\/\/yourapp\.com/],
tracesSampleRate: 0.1 // 10%만 추적
```

### 2. 불필요한 에러 필터링

```typescript
ignoreErrors: [
  'ResizeObserver loop limit exceeded',
  'Non-Error promise rejection',
  /^NotFoundError/
]
```

### 3. Release Health 트래킹

```typescript
Sentry.init({
  release: process.env.NEXT_PUBLIC_RELEASE_VERSION,
  dist: process.env.NEXT_PUBLIC_BUILD_ID
})
```

## 다음 단계

1. ✅ Sentry 전략 수립 (이 문서)
2. ⏭️ Sentry 설정 및 초기화
3. ⏭️ 에러 핸들링 미들웨어 구현
4. ⏭️ API 라우트 통합
5. ⏭️ 프론트엔드 통합
6. ⏭️ 알림 설정 (슬랙, 이메일)
7. ⏭️ 대시보드 구성

## 참고 자료

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)
