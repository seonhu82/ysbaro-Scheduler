# 테스트 가이드

## 개요

연세바로치과 스케줄러의 테스트 전략 및 실행 가이드입니다.

## 테스트 구조

```
src/
├── lib/
│   ├── services/
│   │   └── __tests__/           # 서비스 단위 테스트
│   ├── utils/
│   │   └── __tests__/           # 유틸리티 단위 테스트
│   └── __tests__/
│       └── integration/         # 통합 테스트
└── components/
    └── __tests__/               # 컴포넌트 테스트 (향후)
```

## 테스트 명령어

```bash
# 전체 테스트 실행
npm test

# Watch 모드 (개발 중)
npm run test:watch

# 커버리지 리포트
npm test -- --coverage

# 특정 파일만 테스트
npm test -- category-slot-service
```

## 작성된 테스트

### 1. 단위 테스트 (Unit Tests)

#### category-slot-service.test.ts
**목적**: 구분별 슬롯 가용성 검사 로직 검증

**테스트 케이스**:
- ✅ 슬롯이 충분할 때 승인 가능
- ✅ 전체 슬롯이 부족할 때 보류
- ✅ 구분별 슬롯이 부족할 때 보류 (1/3 룰)
- ✅ 구분이 없는 경우 전체 슬롯만 확인
- ✅ 구분 인원이 1명인 경우 무조건 보류
- ✅ 구분 인원이 2명이고 1명 신청 시 보류 (1/2 도달)

#### on-hold-auto-approval-service.test.ts
**목적**: ON_HOLD 자동 승인 로직 검증

**테스트 케이스**:
- ✅ 슬롯이 충분할 때 ON_HOLD 신청 자동 승인
- ✅ 슬롯이 부족할 때 ON_HOLD 유지
- ✅ DailySlot이 없을 때 모든 신청 실패 처리
- ✅ ON_HOLD 신청이 없을 때 빈 결과 반환
- ✅ 여러 ON_HOLD 신청 중 일부만 승인

#### accessibility.test.ts
**목적**: WCAG 2.1 AA 준수 접근성 유틸리티 검증

**테스트 케이스**:
- ✅ Enter/Space 키 핸들러
- ✅ Escape 키 핸들러
- ✅ ARIA 속성 생성
- ✅ 색상 대비율 계산 (WCAG 기준)
- ✅ 스크린 리더 알림

### 2. 통합 테스트 (Integration Tests)

#### leave-application-flow.test.ts
**목적**: 연차 신청 전체 플로우 end-to-end 검증

**테스트 시나리오**:
- ✅ 정상 신청 → 즉시 승인 플로우
- ✅ 신청 → 보류 → 자동 승인 플로우
- ✅ 다중 신청 경쟁 상황 (선착순 + 구분별 제한)
- ✅ 주간 배치 후 ON_HOLD 일괄 처리

## 테스트 커버리지 목표

| 항목 | 목표 | 현재 상태 |
|------|------|----------|
| Branches | 70% | 진행 중 |
| Functions | 70% | 진행 중 |
| Lines | 70% | 진행 중 |
| Statements | 70% | 진행 중 |

## Mock 데이터 생성

테스트 유틸리티 (`src/lib/test-utils/index.ts`)에서 제공하는 헬퍼 함수 사용:

```typescript
import {
  createMockClinic,
  createMockUser,
  createMockStaff,
  createMockLeaveApplication,
  createMockWeekInfo,
  createMockDailySlot,
  mockPrisma
} from '@/lib/test-utils'

// Mock 데이터 생성
const staff = createMockStaff({
  name: '김철수',
  categoryName: '위생사'
})

// Prisma Mock 사용
mockPrisma.staff.findUnique.mockResolvedValue(staff)
```

## 테스트 작성 가이드

### 1. 단위 테스트

**파일 위치**: `src/lib/services/__tests__/service-name.test.ts`

**기본 구조**:

```typescript
import { serviceName } from '../service-name'
import { mockPrisma, resetAllMocks } from '@/lib/test-utils'

// Mock 의존성
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}))

describe('serviceName', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  describe('functionName', () => {
    it('should do something when condition', async () => {
      // Given: 테스트 데이터 준비
      // When: 함수 실행
      // Then: 결과 검증
    })
  })
})
```

### 2. 통합 테스트

**파일 위치**: `src/lib/__tests__/integration/feature-name.test.ts`

**기본 구조**:

```typescript
describe('전체 플로우', () => {
  it('시나리오 설명', async () => {
    // Given: 초기 상태 설정
    // When: 여러 단계 실행
    // Then: 최종 결과 검증
  })
})
```

## 테스트 베스트 프랙티스

### 1. AAA 패턴 사용

```typescript
it('테스트 설명', async () => {
  // Arrange (Given): 테스트 준비
  const input = createMockData()

  // Act (When): 실행
  const result = await functionUnderTest(input)

  // Assert (Then): 검증
  expect(result).toEqual(expected)
})
```

### 2. 명확한 테스트 이름

```typescript
// ❌ 나쁜 예
it('works', () => {})

// ✅ 좋은 예
it('슬롯이 충분할 때 연차 신청이 즉시 승인됨', () => {})
```

### 3. 독립적인 테스트

```typescript
// 각 테스트는 독립적으로 실행 가능해야 함
beforeEach(() => {
  resetAllMocks() // Mock 초기화
})
```

### 4. Mock 최소화

```typescript
// 필요한 부분만 Mock
jest.mock('../external-service')

// 실제 로직은 테스트
const result = await serviceFunction(input)
```

## CI/CD 통합

GitHub Actions에서 자동 테스트 실행:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test -- --coverage
```

## 추가 예정 테스트

### 1. 동시성 테스트
- 여러 사용자가 동시에 연차 신청
- 동시 배치 실행 방지
- 트랜잭션 격리 수준 검증

### 2. E2E 테스트 (Playwright)
- 로그인 → 연차 신청 → 승인 전체 플로우
- 관리자 대시보드 기능
- 모바일 반응형 테스트

### 3. 성능 테스트
- 대량 데이터 처리 성능
- API 응답 시간
- 데이터베이스 쿼리 최적화

## 문제 해결

### 1. Prisma Mock 관련

**문제**: `prisma.ruleSettings is not a function`

**해결**:
```typescript
(mockPrisma as any).ruleSettings = {
  findUnique: jest.fn().mockResolvedValue({})
}
```

### 2. DOM 환경 필요

**문제**: `document is not defined`

**해결**:
```typescript
/**
 * @jest-environment jsdom
 */
```

### 3. 타임아웃

**문제**: 비동기 테스트 타임아웃

**해결**:
```typescript
jest.setTimeout(10000) // 10초
```

## 참고 자료

- [Jest 공식 문서](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
