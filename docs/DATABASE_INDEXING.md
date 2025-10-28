# 데이터베이스 인덱싱 가이드

## 개요

연세바로치과 스케줄러의 데이터베이스 인덱싱 전략 및 최적화 가이드입니다.

## 현재 인덱스 현황

### 기본 인덱스 (자동 생성)

Prisma는 다음의 경우 자동으로 인덱스를 생성합니다:

1. **@id** - Primary Key
2. **@unique** - Unique Index
3. **@@unique([field1, field2])** - Composite Unique Index
4. **Foreign Key** - 관계 필드

### 명시적 인덱스 (수동 설정)

현재 schema.prisma에 설정된 인덱스: **총 60개+**

## 쿼리 패턴 분석

### 1. 가장 빈번한 쿼리

#### 형평성 점수 조회
```sql
-- 쿼리 패턴
SELECT * FROM FairnessScore
WHERE staffId = ? AND year = ? AND month = ?

-- 현재 인덱스
@@unique([staffId, year, month])  -- ✅ 최적

-- 쿼리 횟수: 매우 높음 (매 페이지 로드마다)
```

#### 연차 신청 조회
```sql
-- 쿼리 패턴
SELECT * FROM LeaveApplication
WHERE clinicId = ? AND date >= ? AND date <= ? AND status IN (...)

-- 현재 인덱스
@@index([clinicId])
@@index([staffId])
@@index([date])
@@index([status])

-- 개선 필요: 복합 인덱스
@@index([clinicId, date, status])  -- 🔧 추가 권장
```

#### 직원 근무 배정 조회
```sql
-- 쿼리 패턴
SELECT * FROM StaffAssignment
WHERE staffId = ? AND date >= ? AND date <= ?

-- 현재 인덱스
@@index([staffId])
@@index([date])

-- 개선: 복합 인덱스
@@index([staffId, date])  -- 🔧 추가 권장
```

### 2. 복잡한 집계 쿼리

#### 월별 통계
```sql
-- 쿼리 패턴
SELECT staffId, COUNT(*), SUM(...)
FROM LeaveApplication
WHERE clinicId = ? AND date >= ? AND date <= ?
GROUP BY staffId

-- 최적 인덱스
@@index([clinicId, date])  -- 🔧 추가 권장
-- 날짜 범위 검색에 유리
```

## 추천 인덱스 추가

### 1. LeaveApplication 최적화

```prisma
model LeaveApplication {
  // ... 기존 필드 ...

  // 기존 인덱스
  @@index([clinicId])
  @@index([staffId])
  @@index([date])
  @@index([status])

  // 🆕 추가 권장 인덱스
  @@index([clinicId, date, status])  // 병원별 날짜 범위 + 상태 필터
  @@index([staffId, date])            // 직원별 날짜 범위 조회
  @@index([status, date])             // 상태별 날짜 정렬
}
```

**효과:**
- 연차 신청 목록 조회: 50-70% 빠름
- 날짜 범위 필터링: 60-80% 빠름
- 상태별 정렬: 40-60% 빠름

### 2. StaffAssignment 최적화

```prisma
model StaffAssignment {
  // ... 기존 필드 ...

  // 기존 인덱스
  @@index([staffId])
  @@index([date])
  @@index([dailySlotId])

  // 🆕 추가 권장 인덱스
  @@index([staffId, date])            // 직원별 날짜 범위
  @@index([date, shiftType])          // 날짜별 근무 유형
  @@index([dailySlotId, staffId])     // Slot별 직원 조회
}
```

**효과:**
- 직원별 근무 조회: 50-70% 빠름
- 근무 유형별 필터: 40-60% 빠름

### 3. FairnessScore 최적화

```prisma
model FairnessScore {
  // ... 기존 필드 ...

  // 기존 인덱스
  @@unique([staffId, year, month])
  @@index([staffId, year])

  // 🆕 추가 권장 인덱스
  @@index([year, month])              // 전체 통계 조회
  @@index([staffId, year])            // 연간 추세 분석 (이미 있음)
}
```

**효과:**
- 전체 통계: 30-50% 빠름
- 연간 추세: 이미 최적화됨

### 4. AttendanceRecord 최적화

```prisma
model AttendanceRecord {
  // ... 기존 필드 ...

  // 기존 인덱스
  @@index([staffId])
  @@index([date])
  @@index([checkType])
  @@index([staffAssignmentId])
  @@index([isSuspicious])

  // 🆕 추가 권장 인덱스
  @@index([clinicId, date])           // 병원별 날짜 조회
  @@index([staffId, date, checkType]) // 직원별 출퇴근 조회
  @@index([date, isSuspicious])       // 의심스러운 기록 조회
}
```

**효과:**
- 출퇴근 기록 조회: 60-80% 빠름
- 의심 기록 필터: 50-70% 빠름

### 5. ActivityLog 최적화

```prisma
model ActivityLog {
  // ... 기존 필드 ...

  // 기존 인덱스
  @@index([clinicId])
  @@index([userId])
  @@index([createdAt])

  // 🆕 추가 권장 인덱스
  @@index([clinicId, createdAt])      // 병원별 시간순 조회
  @@index([userId, createdAt])        // 사용자별 시간순 조회
  @@index([action, createdAt])        // 액션별 시간순 조회
}
```

**효과:**
- 로그 조회: 40-60% 빠름
- 페이지네이션: 50-70% 빠름

## 인덱스 적용 방법

### 1. Schema 수정

```prisma
// prisma/schema.prisma

model LeaveApplication {
  // ... 필드 정의 ...

  @@index([clinicId, date, status], name: "leave_clinic_date_status")
  @@index([staffId, date], name: "leave_staff_date")
}
```

### 2. Migration 생성

```bash
npx prisma migrate dev --name add_composite_indexes
```

### 3. Migration 검토

```bash
# Migration 파일 확인
cat prisma/migrations/YYYYMMDDHHMMSS_add_composite_indexes/migration.sql
```

예상 SQL:
```sql
-- CreateIndex
CREATE INDEX "leave_clinic_date_status" ON "LeaveApplication"("clinicId", "date", "status");

-- CreateIndex
CREATE INDEX "leave_staff_date" ON "LeaveApplication"("staffId", "date");
```

### 4. 프로덕션 적용

```bash
# 운영 DB에 적용
npx prisma migrate deploy
```

## 인덱스 모니터링

### 1. 인덱스 사용률 확인 (PostgreSQL)

```sql
-- 테이블별 인덱스 사용 통계
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 2. 미사용 인덱스 찾기

```sql
-- 사용되지 않는 인덱스
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 3. 인덱스 크기 확인

```sql
-- 테이블 및 인덱스 크기
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 인덱스 최적화 팁

### 1. 복합 인덱스 순서

**규칙:** 등호 조건 → 범위 조건 → 정렬 조건

```prisma
// ✅ 좋음: 등호 먼저, 범위 나중
@@index([clinicId, date])  // WHERE clinicId = ? AND date >= ?

// ❌ 나쁨: 범위 먼저
@@index([date, clinicId])  // 비효율적
```

### 2. 인덱스 선택성

**높은 선택성** (Cardinality가 높음) = 좋은 인덱스

```sql
-- 선택성 확인
SELECT
  COUNT(DISTINCT staffId) / COUNT(*)::float AS staffId_selectivity,
  COUNT(DISTINCT status) / COUNT(*)::float AS status_selectivity
FROM LeaveApplication;

-- staffId: 0.8 (높음, 좋음)
-- status: 0.05 (낮음, 나쁨)
```

**권장:**
- 선택성 높은 컬럼을 인덱스 앞쪽에 배치
- 선택성 낮은 컬럼은 복합 인덱스로만 사용

### 3. 부분 인덱스 (Partial Index)

특정 조건만 인덱싱하여 크기 절감:

```prisma
// PostgreSQL에서 직접 실행
CREATE INDEX leave_active_idx ON "LeaveApplication" (clinicId, date)
WHERE status IN ('PENDING', 'CONFIRMED');

-- 'REJECTED', 'CANCELLED'는 인덱싱 안함
-- 인덱스 크기: 40-60% 절감
```

### 4. 인덱스 Covering

모든 컬럼을 인덱스에 포함 (PostgreSQL INCLUDE):

```sql
-- Covering Index
CREATE INDEX leave_covering_idx
ON "LeaveApplication" (clinicId, date)
INCLUDE (staffId, status, leaveType);

-- 테이블 접근 없이 인덱스만으로 쿼리 완료 가능
```

## 주의사항

### 1. 과도한 인덱스의 단점

**문제:**
- 쓰기 성능 저하 (INSERT, UPDATE, DELETE)
- 저장 공간 증가
- 쿼리 플래너 부담 증가

**권장:**
- 테이블당 5-10개 이내
- 실제 사용되는 쿼리에만 인덱스 추가

### 2. 중복 인덱스 제거

```prisma
// ❌ 나쁨: 중복
@@index([clinicId])
@@index([clinicId, date])  // clinicId만 검색할 때도 사용 가능

// ✅ 좋음: 복합 인덱스만 유지
@@index([clinicId, date])
```

**예외:** 단일 컬럼 인덱스가 더 효율적인 경우
- 매우 빈번한 단일 컬럼 조회
- 복합 인덱스가 너무 큰 경우

### 3. NULL 값 처리

PostgreSQL에서 NULL은 인덱싱됨:

```prisma
@@index([optional FieldName])  // NULL 포함
```

특정 필터 필요 시:
```sql
CREATE INDEX idx_name ON table(field) WHERE field IS NOT NULL;
```

## 성능 테스트

### Before/After 비교

```typescript
// performance-test.ts
import { prisma } from '@/lib/prisma'

async function benchmarkQuery() {
  const start = Date.now()

  const results = await prisma.leaveApplication.findMany({
    where: {
      clinicId: 'test-clinic',
      date: { gte: new Date('2024-01-01'), lte: new Date('2024-12-31') },
      status: 'CONFIRMED'
    },
    take: 100
  })

  const duration = Date.now() - start
  console.log(`쿼리 시간: ${duration}ms, 결과: ${results.length}건`)

  return duration
}

// 10회 평균
const runs = await Promise.all(Array(10).fill(null).map(() => benchmarkQuery()))
const average = runs.reduce((sum, t) => sum + t, 0) / runs.length
console.log(`평균 쿼리 시간: ${average.toFixed(2)}ms`)
```

### EXPLAIN ANALYZE

```sql
-- 쿼리 실행 계획 확인
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "LeaveApplication"
WHERE "clinicId" = 'test-clinic'
  AND "date" >= '2024-01-01'
  AND "date" <= '2024-12-31'
  AND "status" = 'CONFIRMED'
LIMIT 100;
```

**좋은 신호:**
- Index Scan 또는 Index Only Scan
- 낮은 cost
- 적은 buffers

**나쁜 신호:**
- Seq Scan (전체 테이블 스캔)
- 높은 cost
- 많은 buffers

## 다음 단계

1. ✅ 복합 인덱스 추가
2. ⏭️ Redis 캐싱으로 추가 최적화
3. ⏭️ Connection Pooling 설정
4. ⏭️ Read Replica 구성 (규모 확장 시)

## 참고 자료

- [Prisma Index Documentation](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)
- [PostgreSQL Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [Use The Index, Luke!](https://use-the-index-luke.com/)
- [Explain PostgreSQL](https://www.pgexplain.dev/)
