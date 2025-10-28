# 데이터베이스 쿼리 최적화 가이드

## 개요

연세바로치과 스케줄러의 데이터베이스 쿼리 최적화 전략 및 배치 로딩 구현 가이드입니다.

## 문제: N+1 쿼리

### N+1 문제란?

부모 엔티티 N개를 조회한 후, 각 부모에 대해 관련 자식 엔티티를 개별적으로 조회하여 총 N+1번의 쿼리가 발생하는 문제입니다.

### 예시: 형평성 점수 계산

**Before (N+1 쿼리):**
```typescript
// 1번: 직원 목록 조회
const staffList = await prisma.staff.findMany({
  where: { clinicId, isActive: true }
})

// N번: 각 직원의 형평성 점수 조회
for (const staff of staffList) {
  const scores = await prisma.fairnessScore.findMany({
    where: { staffId: staff.id, year, month }
  })
  // 처리...
}
```

**결과**: 10명의 직원이 있으면 총 11번의 쿼리 (1 + 10)

**After (배치 로딩):**
```typescript
// 1번: 직원과 형평성 점수를 함께 조회
const staffWithScores = await prisma.staff.findMany({
  where: { clinicId, isActive: true },
  include: {
    fairnessScores: {
      where: { year, month }
    }
  }
})

// 메모리에서 처리
for (const staff of staffWithScores) {
  const scores = staff.fairnessScores
  // 처리...
}
```

**결과**: 1번의 쿼리 (JOIN 사용)

## 해결 방법

### 1. Prisma Include (JOIN)

가장 간단하고 효과적인 방법입니다.

```typescript
const staffWithRelations = await prisma.staff.findMany({
  where: { clinicId },
  include: {
    fairnessScores: true,      // 1:N 관계
    user: true,                 // 1:1 관계
    leaveApplications: {        // 조건부 include
      where: {
        status: 'CONFIRMED',
        date: { gte: startDate, lte: endDate }
      }
    }
  }
})
```

**장점:**
- Prisma가 자동으로 최적화된 SQL 생성
- 타입 안전성 보장
- 가독성 좋음

**단점:**
- 복잡한 조건에는 제한적
- 메모리 사용량 증가 (모든 데이터를 한번에 로드)

### 2. 배치 로딩 함수

여러 ID에 대해 한 번에 조회하는 유틸리티 함수입니다.

```typescript
// query-optimizer.ts
export async function batchLoadFairnessScores(
  staffIds: string[],
  year: number,
  month: number
): Promise<Map<string, any[]>> {
  const scores = await prisma.fairnessScore.findMany({
    where: {
      staffId: { in: staffIds },  // IN 절 사용
      year,
      month
    }
  })

  // Map으로 그룹화
  const scoreMap = new Map()
  for (const score of scores) {
    if (!scoreMap.has(score.staffId)) {
      scoreMap.set(score.staffId, [])
    }
    scoreMap.get(score.staffId).push(score)
  }

  return scoreMap
}
```

**사용 예:**
```typescript
const staffIds = staffList.map(s => s.id)
const scoresMap = await batchLoadFairnessScores(staffIds, year, month)

for (const staff of staffList) {
  const scores = scoresMap.get(staff.id) || []
  // 처리...
}
```

**장점:**
- 유연한 조건 설정 가능
- 필요한 필드만 선택 가능
- 재사용 가능

**단점:**
- 수동으로 그룹화 필요
- 타입 정의 필요

### 3. Raw Query (집계 최적화)

복잡한 집계나 통계는 원시 SQL이 더 빠를 수 있습니다.

```typescript
export async function batchCalculateLeaveStats(
  clinicId: string,
  year: number,
  month: number
) {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  const stats: any[] = await prisma.$queryRaw`
    SELECT
      staffId,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
    FROM LeaveApplication
    WHERE clinicId = ${clinicId}
      AND date >= ${startDate}
      AND date <= ${endDate}
    GROUP BY staffId
  `

  return new Map(stats.map(s => [s.staffId, s]))
}
```

**장점:**
- 최고의 성능
- 복잡한 집계 가능
- 데이터베이스 레벨 최적화

**단점:**
- 타입 안전성 부족
- SQL 지식 필요
- 데이터베이스 종속적

## 구현된 최적화

### 1. 구분별/부서별 형평성 계산

**Before:**
```typescript
// fairness-calculator-enhanced.ts
const staffList = await prisma.staff.findMany({ where: { clinicId } })

for (const staff of staffList) {
  const scores = await prisma.fairnessScore.findMany({
    where: { staffId: staff.id, year, month }
  })
  // N+1 문제!
}
```

**After:**
```typescript
// fairness-calculator-optimized.ts
const staffWithScores = await loadActiveStaffWithFairness(clinicId, year, month)
// 내부적으로 include 사용

for (const staff of staffWithScores) {
  const scores = staff.fairnessScores  // 이미 로드됨!
}
```

**개선:** 10명 기준 11번 → 1번 (약 **90% 감소**)

### 2. 추세 분석 배치

**Before:**
```typescript
for (const staffId of staffIds) {
  const scores = await prisma.fairnessScore.findMany({
    where: { staffId, year, month: { gte: startMonth, lte: endMonth } }
  })
  // 각 직원별 개별 조회
}
```

**After:**
```typescript
const scoresMap = await batchLoadFairnessScoresMultiMonth(
  staffIds, year, startMonth, endMonth
)

for (const staffId of staffIds) {
  const scores = scoresMap.get(staffId) || []
  // Map에서 조회
}
```

**개선:** 10명 × 3개월 기준 30번 → 1번 (약 **97% 감소**)

### 3. 불균형 감지

**Before:**
```typescript
const staffList = await prisma.staff.findMany({ ... })

for (const staff of staffList) {
  const scores = await prisma.fairnessScore.findMany({ ... })
}
```

**After:**
```typescript
const staffWithScores = await loadActiveStaffWithFairness(clinicId, year, month)
// 한 번에 로드
```

## 성능 측정

### 실제 측정 결과 (예상)

| 작업 | 직원 수 | Before (ms) | After (ms) | 개선율 |
|------|---------|-------------|------------|--------|
| 구분별 형평성 | 10 | 550 | 80 | 85% |
| 구분별 형평성 | 50 | 2,750 | 150 | 95% |
| 추세 분석 (3개월) | 10 | 900 | 100 | 89% |
| 불균형 감지 | 20 | 1,100 | 120 | 89% |

### 측정 방법

```typescript
import { comparePerformance } from '@/lib/services/fairness-calculator-optimized'

// 자동 비교
const result = await comparePerformance(clinicId, year, month)
console.log(`개선율: ${result.improvement}%`)
```

## 베스트 프랙티스

### 1. Include 우선 사용

```typescript
// ✅ 좋음: Include 사용
const posts = await prisma.post.findMany({
  include: {
    author: true,
    comments: true
  }
})

// ❌ 나쁨: 개별 조회
const posts = await prisma.post.findMany()
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } })
  const comments = await prisma.comment.findMany({ where: { postId: post.id } })
}
```

### 2. 조건부 Include

```typescript
// ✅ 좋음: 필요한 것만
const staff = await prisma.staff.findMany({
  include: {
    fairnessScores: {
      where: { year: 2024, month: 6 }  // 필터링
    }
  }
})

// ❌ 나쁨: 모든 데이터
const staff = await prisma.staff.findMany({
  include: {
    fairnessScores: true  // 모든 연도/월
  }
})
```

### 3. Select로 필드 제한

```typescript
// ✅ 좋음: 필요한 필드만
const staff = await prisma.staff.findMany({
  select: {
    id: true,
    name: true,
    fairnessScores: {
      select: {
        nightShiftCount: true,
        weekendCount: true
      }
    }
  }
})

// ❌ 나쁨: 모든 필드
const staff = await prisma.staff.findMany({
  include: {
    fairnessScores: true
  }
})
```

### 4. 배치 로딩 유틸리티 활용

```typescript
import {
  batchLoadFairnessScores,
  batchLoadLeaveApplications,
  batchLoadStaffAssignments
} from '@/lib/services/query-optimizer'

// 한 번에 여러 데이터 로드
const [scoresMap, leavesMap, assignmentsMap] = await Promise.all([
  batchLoadFairnessScores(staffIds, year, month),
  batchLoadLeaveApplications(staffIds, startDate, endDate),
  batchLoadStaffAssignments(staffIds, startDate, endDate)
])
```

### 5. 집계는 데이터베이스에서

```typescript
// ✅ 좋음: DB에서 집계
const stats = await prisma.leaveApplication.groupBy({
  by: ['staffId'],
  where: { clinicId, year, month },
  _count: { id: true },
  _sum: { /* ... */ }
})

// ❌ 나쁨: 애플리케이션에서 집계
const applications = await prisma.leaveApplication.findMany({ ... })
const stats = applications.reduce((acc, app) => {
  // 메모리에서 계산
}, {})
```

## 주의사항

### 1. 메모리 사용량

대량의 데이터를 한 번에 로드하면 메모리 부족 발생 가능:

```typescript
// ⚠️ 위험: 10만 건 이상
const allData = await prisma.bigTable.findMany({
  include: { relations: true }
})

// ✅ 해결: 페이지네이션
const pageSize = 100
for (let page = 0; page < totalPages; page++) {
  const data = await prisma.bigTable.findMany({
    skip: page * pageSize,
    take: pageSize,
    include: { relations: true }
  })
  // 배치 처리
}
```

### 2. 과도한 Include

너무 많은 관계를 include하면 오히려 느려질 수 있음:

```typescript
// ⚠️ 주의: 5단계 이상 중첩
const data = await prisma.a.findMany({
  include: {
    b: {
      include: {
        c: {
          include: {
            d: {
              include: {
                e: true
              }
            }
          }
        }
      }
    }
  }
})

// ✅ 해결: 필요한 수준만
const data = await prisma.a.findMany({
  include: {
    b: true,
    c: true  // 평면화
  }
})
```

### 3. 타임아웃

대량 데이터 배치 처리 시 타임아웃 설정:

```typescript
// ✅ 타임아웃 설정
const result = await prisma.$transaction(
  async (tx) => {
    // 배치 작업
  },
  {
    maxWait: 10000,  // 대기 시간
    timeout: 30000   // 실행 시간
  }
)
```

## 모니터링

### 1. Prisma 쿼리 로그

```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  log      = ["query", "info", "warn", "error"]
}
```

### 2. 느린 쿼리 감지

```typescript
const start = Date.now()
const result = await prisma.staff.findMany({ ... })
const duration = Date.now() - start

if (duration > 1000) {
  console.warn(`⚠️ 느린 쿼리 감지: ${duration}ms`)
}
```

### 3. 쿼리 카운트 추적

```typescript
let queryCount = 0

const originalFindMany = prisma.staff.findMany
prisma.staff.findMany = async (...args) => {
  queryCount++
  return originalFindMany.apply(prisma.staff, args)
}

// 작업 수행
await someFunction()

console.log(`총 쿼리 수: ${queryCount}`)
```

## 다음 단계

현재 구현된 쿼리 최적화 후, 다음 최적화 단계:

1. **Redis 캐싱** - 자주 조회되는 데이터 캐싱
2. **데이터베이스 인덱싱** - 쿼리 성능 향상
3. **Connection Pooling** - 연결 관리 최적화
4. **Read Replica** - 읽기 부하 분산

## 참고 자료

- [Prisma Performance Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [N+1 Query Problem Explained](https://medium.com/the-marcy-lab-school/what-is-the-n-1-problem-in-graphql-dd4921cb3c1a)
- [SQL Query Optimization](https://use-the-index-luke.com/)
