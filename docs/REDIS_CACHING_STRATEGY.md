# Redis 캐싱 전략

## 개요

연세바로치과 스케줄러의 통계 및 자주 조회되는 데이터에 대한 Redis 캐싱 전략입니다.

## 캐싱 대상 데이터

### 1. 형평성 통계 (높은 우선순위)

**이유**:
- 매우 복잡한 계산 (여러 테이블 JOIN, 집계 연산)
- 자주 조회됨 (대시보드, 배치 시 참조)
- 변경 빈도 낮음 (월 1회 재계산)

**캐시 키 패턴**:
```typescript
fairness:stats:{clinicId}:{year}:{month}
fairness:category:{clinicId}:{year}:{month}
fairness:department:{clinicId}:{year}:{month}
fairness:staff:{staffId}:{year}:{month}
fairness:trends:{staffId}:{year}:{startMonth}:{endMonth}
```

**TTL**: 24시간 (86400초)
**무효화 시점**: 형평성 점수 업데이트 시, 스케줄 변경 시

### 2. 월간 통계 (높은 우선순위)

**이유**:
- 복잡한 집계 쿼리
- 대시보드에서 자주 조회
- 월 단위로만 변경

**캐시 키 패턴**:
```typescript
stats:monthly:{clinicId}:{year}:{month}
stats:staff:{staffId}:{year}:{month}
stats:leave:{clinicId}:{year}:{month}
stats:attendance:{clinicId}:{year}:{month}
```

**TTL**: 12시간 (43200초)
**무효화 시점**: 연차 승인/거절, 스케줄 변경

### 3. 직원 목록 (중간 우선순위)

**이유**:
- 자주 조회됨
- 변경 빈도 낮음
- JOIN 쿼리 필요

**캐시 키 패턴**:
```typescript
staff:list:{clinicId}
staff:active:{clinicId}
staff:by-category:{clinicId}:{category}
staff:by-department:{clinicId}:{department}
```

**TTL**: 30분 (1800초)
**무효화 시점**: 직원 추가/수정/삭제

### 4. 주간 슬롯 정보 (중간 우선순위)

**이유**:
- 복잡한 계산 (슬롯 할당 로직)
- 배치 시 반복 참조
- 일주일 단위로 변경

**캐시 키 패턴**:
```typescript
week:info:{clinicId}:{year}:{month}:{weekNumber}
week:slots:{clinicId}:{year}:{month}:{weekNumber}
daily:slot:{clinicId}:{date}
```

**TTL**: 1시간 (3600초)
**무효화 시점**: 주간 배치 완료, 재배치 발생

### 5. 공휴일 정보 (낮은 우선순위)

**이유**:
- 자주 조회됨
- 거의 변경 안됨
- 간단한 데이터

**캐시 키 패턴**:
```typescript
holidays:{clinicId}:{year}
holidays:{clinicId}:{year}:{month}
```

**TTL**: 7일 (604800초)
**무효화 시점**: 공휴일 설정 변경

### 6. 설정 정보 (낮은 우선순위)

**이유**:
- 매우 자주 조회
- 거의 변경 안됨

**캐시 키 패턴**:
```typescript
settings:fairness:{clinicId}
settings:rules:{clinicId}
settings:notification:{clinicId}
```

**TTL**: 1시간 (3600초)
**무효화 시점**: 설정 변경

## 캐싱하지 않을 데이터

### 1. 실시간성이 중요한 데이터
- 출퇴근 기록 (실시간 조회 필요)
- 연차 신청 상태 (즉시 반영 필요)
- 알림 (실시간성 중요)

### 2. 자주 변경되는 데이터
- 진행 중인 배치 상태
- 사용자 세션
- QR 토큰 (이미 TTL 관리됨)

### 3. 큰 용량의 데이터
- 전체 활동 로그
- 백업 데이터

## 캐시 무효화 전략

### 1. Time-based (TTL)
가장 기본적인 방법. 모든 캐시에 적용.

```typescript
await redis.setex(key, ttl, JSON.stringify(data))
```

### 2. Event-based (이벤트 기반)
데이터 변경 시 즉시 무효화.

```typescript
// 연차 승인 시
async function approveLeave(leaveId: string) {
  await prisma.leaveApplication.update({ ... })

  // 관련 캐시 무효화
  await invalidateCache([
    `stats:monthly:${clinicId}:${year}:${month}`,
    `stats:leave:${clinicId}:${year}:${month}`,
    `fairness:stats:${clinicId}:${year}:${month}`
  ])
}
```

### 3. Pattern-based (패턴 기반)
관련된 모든 캐시를 한번에 무효화.

```typescript
async function invalidateFairnessCache(clinicId: string, year: number, month: number) {
  const pattern = `fairness:*:${clinicId}:${year}:${month}`
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
```

## Redis 데이터 구조

### 1. String (대부분의 경우)
JSON 직렬화된 객체 저장.

```typescript
const data = { staffCount: 20, avgScore: 85 }
await redis.set(key, JSON.stringify(data), 'EX', 3600)

const cached = await redis.get(key)
const parsed = cached ? JSON.parse(cached) : null
```

### 2. Hash (구조화된 데이터)
필드별 접근이 필요한 경우.

```typescript
await redis.hset(`staff:${staffId}`, {
  name: 'John',
  category: '고년차',
  department: '진료실'
})

const name = await redis.hget(`staff:${staffId}`, 'name')
```

### 3. Set (고유 목록)
중복 없는 ID 목록.

```typescript
await redis.sadd(`clinic:${clinicId}:staff`, staffId1, staffId2)
const allStaff = await redis.smembers(`clinic:${clinicId}:staff`)
```

### 4. Sorted Set (순위/점수)
형평성 점수 순위 등.

```typescript
await redis.zadd('fairness:ranking', score1, staffId1, score2, staffId2)
const topStaff = await redis.zrange('fairness:ranking', 0, 9) // Top 10
```

## 성능 최적화 팁

### 1. Pipeline 사용
여러 명령을 한번에 실행.

```typescript
const pipeline = redis.pipeline()
pipeline.get('key1')
pipeline.get('key2')
pipeline.get('key3')
const results = await pipeline.exec()
```

### 2. 적절한 직렬화
큰 객체는 MessagePack 사용 고려.

```typescript
import msgpack from 'msgpack-lite'

await redis.set(key, msgpack.encode(data), 'EX', 3600)
const decoded = msgpack.decode(await redis.get(key))
```

### 3. 캐시 워밍 (Cache Warming)
자주 사용되는 데이터를 미리 캐싱.

```typescript
async function warmCache(clinicId: string) {
  const staff = await prisma.staff.findMany({ where: { clinicId } })
  await redis.set(`staff:list:${clinicId}`, JSON.stringify(staff), 'EX', 1800)
}
```

### 4. Stale-While-Revalidate
만료된 캐시를 제공하면서 백그라운드에서 갱신.

```typescript
async function getWithSWR(key: string, fetchFn: () => Promise<any>, ttl: number) {
  const cached = await redis.get(key)
  const cacheAge = await redis.ttl(key)

  if (cached && cacheAge > ttl * 0.1) {
    // 캐시가 충분히 신선함
    return JSON.parse(cached)
  }

  if (cached) {
    // 캐시가 곧 만료됨, 백그라운드 갱신
    fetchFn().then(data => redis.setex(key, ttl, JSON.stringify(data)))
    return JSON.parse(cached)
  }

  // 캐시 미스, 즉시 가져오기
  const data = await fetchFn()
  await redis.setex(key, ttl, JSON.stringify(data))
  return data
}
```

## 모니터링

### 1. 캐시 히트율 추적
```typescript
let hits = 0
let misses = 0

async function getCached(key: string) {
  const value = await redis.get(key)
  if (value) {
    hits++
    return JSON.parse(value)
  }
  misses++
  return null
}

function getHitRate() {
  return hits / (hits + misses)
}
```

### 2. Redis 메모리 사용량
```bash
redis-cli info memory
```

### 3. 느린 쿼리 로깅
```typescript
const start = Date.now()
const data = await getCached(key)
const duration = Date.now() - start

if (duration > 100) {
  console.warn(`Slow cache operation: ${key} took ${duration}ms`)
}
```

## 주의사항

### 1. 메모리 부족 시 정책
Redis가 가득 찰 경우 정책 설정.

```bash
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru  # LRU로 자동 삭제
```

### 2. 직렬화 오류 처리
```typescript
try {
  const data = JSON.parse(cached)
  return data
} catch (error) {
  console.error('Cache deserialization failed:', error)
  await redis.del(key)  // 손상된 캐시 삭제
  return null
}
```

### 3. 캐시 스탬피드 방지
동시에 많은 요청이 캐시 미스 시 DB 과부하.

```typescript
const locks = new Map<string, Promise<any>>()

async function getOrFetch(key: string, fetchFn: () => Promise<any>) {
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached)

  // 이미 가져오는 중이면 대기
  if (locks.has(key)) {
    return locks.get(key)
  }

  // 락 설정하고 가져오기
  const promise = fetchFn().then(async data => {
    await redis.setex(key, 3600, JSON.stringify(data))
    locks.delete(key)
    return data
  })

  locks.set(key, promise)
  return promise
}
```

## 다음 단계

1. ✅ Redis 캐싱 전략 수립 (이 문서)
2. ⏭️ Redis 클라이언트 설정 및 유틸리티 작성
3. ⏭️ 형평성 통계 캐싱 구현
4. ⏭️ 월간 통계 캐싱 구현
5. ⏭️ 캐시 무효화 로직 통합
6. ⏭️ 성능 테스트 및 모니터링

## 참고 자료

- [Redis Documentation](https://redis.io/documentation)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [Upstash Redis for Serverless](https://upstash.com/docs/redis)
- [Caching Strategies](https://aws.amazon.com/caching/best-practices/)
