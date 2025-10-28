# 개선된 형평성 알고리즘 v2.0

## 개요

연세바로치과 스케줄러의 향상된 형평성 계산 시스템으로, 다차원적이고 세밀한 공정성 추적 및 자동 조정 기능을 제공합니다.

## 주요 개선 사항

### 1. 다차원 형평성 점수 계산

기존의 단순한 야간/주말 근무 카운트에서 확장:

- **야간 근무** (기본 가중치: 3)
- **주말 근무** (기본 가중치: 2)
- **공휴일 근무** (기본 가중치: 4)
- **공휴일 전후 근무** (기본 가중치: 1.5)

```typescript
const result = calculateEnhancedFairnessScore(
  metrics,
  allStaffMetrics,
  {
    nightShift: 3,
    weekend: 2,
    holiday: 4,
    holidayAdjacent: 1.5
  }
)
```

#### 점수 계산 로직

1. 각 근무 유형별 평균 계산
2. 직원별 편차 계산 (절대값)
3. 가중 평균 편차 계산
4. 정규화 (0-100점, 100점에 가까울수록 공정)
5. 등급 부여:
   - EXCELLENT: 90점 이상
   - GOOD: 75-89점
   - FAIR: 60-74점
   - POOR: 59점 이하

### 2. 구분별 형평성 추적

직원 구분(위생사, 간호조무사 등)별로 독립적인 형평성 점수 계산:

```typescript
const categoryFairness = await calculateCategoryFairness(clinicId, year, month)

// 결과 예시:
// {
//   "위생사": {
//     staffCount: 3,
//     averageScore: 79,
//     averageNightShifts: 5.0,
//     averageWeekendShifts: 3.0,
//     variance: 2.5,
//     grade: "GOOD"
//   },
//   "간호조무사": {
//     staffCount: 2,
//     averageScore: 85,
//     ...
//   }
// }
```

**특징:**
- 구분 내 직원 간 형평성 측정
- 구분 간 근무 패턴 비교 가능
- 변동계수(CV)를 사용한 상대적 공정성 평가

### 3. 부서별 형평성 추적

부서(진료부, 행정부 등)별 집계:

```typescript
const deptFairness = await calculateDepartmentFairness(clinicId, year, month)

// 결과 예시:
// {
//   "진료부": {
//     staffCount: 5,
//     averageScore: 82,
//     averageNightShifts: 4.5,
//     averageWeekendShifts: 3.2,
//     variance: 3.1,
//     grade: "GOOD"
//   }
// }
```

### 4. 장기 추세 분석

여러 달에 걸친 형평성 변화 패턴 분석:

```typescript
const trend = await analyzeFairnessTrends(staffId, year, endMonth, 3)

// 결과 예시:
// {
//   staffId: "staff-1",
//   trend: "INCREASING",  // INCREASING | DECREASING | STABLE
//   monthlyScores: [
//     { year: 2024, month: 4, totalShifts: 8, weightedShifts: 32.5 },
//     { year: 2024, month: 5, totalShifts: 10, weightedShifts: 40.0 },
//     { year: 2024, month: 6, totalShifts: 12, weightedShifts: 48.5 }
//   ],
//   averageMonthlyIncrease: 8.0,
//   projectedNextMonth: 56.5
// }
```

**활용:**
- 특정 직원의 근무 부담 증가/감소 패턴 파악
- 다음 달 근무량 예측
- 조기 개입을 통한 과로 방지

### 5. 불균형 자동 감지

통계적 방법(표준편차 기반)으로 불균형 감지:

```typescript
const imbalance = await detectFairnessImbalance(clinicId, year, month, threshold)

// threshold: 표준편차 배수 (기본값 1.5)
// 1.5 표준편차 이상 벗어난 직원을 불균형으로 판단

// 결과 예시:
// {
//   hasImbalance: true,
//   imbalancedStaff: [
//     {
//       staffId: "staff-1",
//       staffName: "김철수",
//       type: "OVERWORKED",  // OVERWORKED | UNDERWORKED
//       severity: "HIGH",     // HIGH | MEDIUM | LOW
//       nightShiftDeviation: 5.2,
//       weekendShiftDeviation: 3.1,
//       totalDeviation: 8.3
//     }
//   ],
//   averageNightShifts: 5.0,
//   averageWeekendShifts: 3.0
// }
```

**심각도 기준:**
- HIGH: 3 표준편차 이상
- MEDIUM: 2.5-3 표준편차
- LOW: 2-2.5 표준편차

### 6. 자동 조정 제안

불균형이 감지되면 자동으로 조정 방안 제시:

```typescript
const adjustments = await suggestFairnessAdjustments(clinicId, year, month)

// 결과 예시:
// {
//   needsAdjustment: true,
//   suggestions: [
//     {
//       staffId: "staff-1",
//       staffName: "김철수",
//       action: "REDUCE",  // REDUCE | INCREASE | MAINTAIN
//       nightShiftAdjustment: -3,
//       weekendShiftAdjustment: -2,
//       reason: "과도한 근무 (심각도: HIGH)",
//       priority: "HIGH"  // HIGH | MEDIUM | LOW
//     },
//     {
//       staffId: "staff-2",
//       staffName: "이영희",
//       action: "INCREASE",
//       nightShiftAdjustment: +2,
//       weekendShiftAdjustment: +1,
//       reason: "부족한 근무 (심각도: MEDIUM)",
//       priority: "MEDIUM"
//     }
//   ],
//   expectedImpact: {
//     varianceReduction: 4.5,
//     fairnessScoreIncrease: 9.0
//   }
// }
```

**조정 로직:**
- 과도 근무자: 편차의 50%만큼 감소 제안
- 부족 근무자: 편차의 50%만큼 증가 제안
- 우선순위는 심각도에 따라 결정

## 사용 예시

### 월간 형평성 리포트 생성

```typescript
import {
  calculateCategoryFairness,
  calculateDepartmentFairness,
  detectFairnessImbalance,
  suggestFairnessAdjustments
} from '@/lib/services/fairness-calculator-enhanced'

async function generateMonthlyFairnessReport(clinicId: string, year: number, month: number) {
  // 1. 구분별 형평성
  const categoryFairness = await calculateCategoryFairness(clinicId, year, month)

  // 2. 부서별 형평성
  const deptFairness = await calculateDepartmentFairness(clinicId, year, month)

  // 3. 불균형 감지
  const imbalance = await detectFairnessImbalance(clinicId, year, month)

  // 4. 조정 제안 (불균형 있을 경우)
  const adjustments = await suggestFairnessAdjustments(clinicId, year, month)

  return {
    categoryFairness,
    deptFairness,
    imbalance,
    adjustments,
    generatedAt: new Date()
  }
}
```

### 개별 직원 추세 모니터링

```typescript
import { analyzeFairnessTrends } from '@/lib/services/fairness-calculator-enhanced'

async function monitorStaffWorkload(staffId: string) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // 최근 6개월 추세 분석
  const trend = await analyzeFairnessTrends(staffId, year, month, 6)

  if (trend.trend === 'INCREASING' && trend.averageMonthlyIncrease > 5) {
    console.warn(`⚠️ ${staffId}: 근무량이 지속적으로 증가 중 (월평균 +${trend.averageMonthlyIncrease})`)
    return {
      alert: true,
      message: '과로 위험, 조기 개입 필요',
      projectedNextMonth: trend.projectedNextMonth
    }
  }

  return { alert: false, trend }
}
```

## 테스트 커버리지

### 단위 테스트 (`fairness-calculator-enhanced.test.ts`)

- ✅ 다차원 형평성 점수 계산 (11개 테스트)
  - 기본 점수 계산
  - 커스텀 가중치 적용
  - 구분별 형평성
  - 부서별 형평성
  - 추세 분석 (증가/감소/안정)
  - 불균형 감지
  - 자동 조정 제안

모든 테스트 통과:
```
PASS src/lib/services/__tests__/fairness-calculator-enhanced.test.ts
  fairness-calculator-enhanced
    calculateEnhancedFairnessScore
      ✓ 다차원 형평성 점수 계산 (야간/주말/공휴일)
      ✓ 가중치를 커스텀할 수 있음
    calculateCategoryFairness
      ✓ 구분별 형평성 계산 (위생사 vs 간호조무사)
      ✓ 구분 내 형평성과 구분 간 형평성을 모두 계산
    calculateDepartmentFairness
      ✓ 부서별 형평성 계산
    analyzeFairnessTrends
      ✓ 여러 달에 걸친 형평성 추세 분석
      ✓ 감소 추세 감지
    detectFairnessImbalance
      ✓ 심각한 불균형 감지 (낮은 임계값)
      ✓ 균형 잡힌 상태 감지
    suggestFairnessAdjustments
      ✓ 자동 조정 제안 생성 (낮은 임계값)
      ✓ 균형 잡힌 상태에서는 조정 불필요

Tests:       11 passed, 11 total
```

## 데이터베이스 스키마

### FairnessScore 테이블

```prisma
model FairnessScore {
  id                     String   @id @default(cuid())
  staffId                String
  year                   Int
  month                  Int      // 1-12
  nightShiftCount        Int      @default(0)
  weekendCount           Int      @default(0)
  holidayCount           Int      @default(0)
  holidayAdjacentCount   Int      @default(0)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  staff                  Staff    @relation(fields: [staffId], references: [id])

  @@unique([staffId, year, month])
  @@index([staffId, year])
}
```

## 성능 고려사항

### 현재 구현

- **시간 복잡도**: O(N × M)
  - N: 직원 수
  - M: 조회 월 수
- **데이터베이스 쿼리**: 직원당 1-2회

### 향후 최적화 계획

1. **배치 로딩**
   - 모든 직원의 FairnessScore를 한 번에 조회
   - `WHERE staffId IN (...) AND year = ? AND month = ?`

2. **캐싱** (Redis)
   - 월간 통계는 변경 빈도가 낮음
   - 15분 TTL로 캐싱
   - 배치 완료 시 무효화

3. **백그라운드 집계**
   - 야간 배치로 월간 리포트 사전 계산
   - 실시간 요청 시 즉시 반환

## 향후 개선 계획

### Phase 4 (예정)

1. **머신러닝 기반 예측**
   - 과거 패턴 학습
   - 3-6개월 후 형평성 예측
   - 조기 경고 시스템

2. **개인별 선호도 반영**
   - 야간 근무 선호/비선호
   - 주말 근무 선호/비선호
   - 가중치 자동 조정

3. **팀 기반 형평성**
   - 같은 팀 내 형평성 우선
   - 팀 간 형평성 2차 고려

4. **실시간 대시보드**
   - 형평성 점수 실시간 모니터링
   - 불균형 알림 자동 발송
   - 조정 제안 원클릭 적용

## 관련 문서

- [기존 형평성 계산](./fairness-calculator.ts)
- [형평성 점수 업데이트 서비스](../lib/services/fairness-score-update-service.ts)
- [형평성 검증 서비스](../lib/services/fairness-validation-service.ts)
- [테스트 가이드](./TESTING.md)

## 작성자

- **버전**: 2.0
- **작성일**: 2025-01-XX
- **작성자**: Claude Code
- **상태**: ✅ 구현 완료, 테스트 통과
