# 감사 로그 시스템 강화 전략

## 개요

보안, 규정 준수, 문제 해결을 위한 포괄적인 감사 로그 시스템 강화.

**작성일**: 2025-10-28
**구현 대상**: 연세바로치과 스케줄러

## 현재 ActivityLog 시스템

### 기존 구조
```typescript
model ActivityLog {
  id           String       @id @default(cuid())
  clinicId     String
  userId       String?
  activityType ActivityType
  description  String
  metadata     Json?
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime     @default(now())
}
```

### 한계점
- 변경 전후 데이터 비교 불가
- 보안 이벤트 별도 추적 없음
- 로그 보존 정책 없음
- 규정 준수 기능 부족
- 검색 및 필터링 제한적

## 강화 목표

### 1. 변경 이력 추적 (Change Tracking)
모든 중요 데이터의 변경 전후 상태를 기록:

```typescript
interface AuditEntry {
  id: string
  timestamp: Date
  actor: { id: string; name: string; role: string }
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  resource: { type: string; id: string }
  changes: {
    field: string
    oldValue: any
    newValue: any
  }[]
  metadata: {
    ipAddress: string
    userAgent: string
    requestId: string
    sessionId: string
  }
}
```

### 2. 보안 이벤트 추적
보안 관련 이벤트를 별도로 추적:

- 로그인 성공/실패
- 권한 변경
- 민감한 데이터 접근
- 비정상적인 활동 패턴
- API 키 생성/삭제

### 3. 규정 준수
의료 정보 관련 규정 준수:

- 환자 정보 접근 로그 (개인정보보호법)
- 데이터 수정 이력 (의료법)
- 삭제 데이터 복구 가능성
- 로그 무결성 보장

### 4. 고급 검색 및 필터링
```typescript
interface AuditQuery {
  actor?: string
  resourceType?: string
  action?: string
  dateRange?: { from: Date; to: Date }
  changes?: { field: string; oldValue?: any; newValue?: any }
  securityLevel?: 'low' | 'medium' | 'high' | 'critical'
}
```

## 새로운 ActivityType 확장

### 기존
```typescript
enum ActivityType {
  USER_LOGIN
  LEAVE_APPLICATION_CREATED
  SCHEDULE_ASSIGNED
  // ... 기타
}
```

### 추가 (보안 이벤트)
```typescript
enum SecurityEventType {
  // 인증
  LOGIN_SUCCESS
  LOGIN_FAILED
  LOGOUT
  PASSWORD_CHANGED
  PASSWORD_RESET_REQUESTED
  PASSWORD_RESET_COMPLETED
  MFA_ENABLED
  MFA_DISABLED

  // 권한
  ROLE_CHANGED
  PERMISSION_GRANTED
  PERMISSION_REVOKED
  ACCOUNT_SUSPENDED
  ACCOUNT_REACTIVATED

  // 민감한 작업
  SENSITIVE_DATA_ACCESSED
  BULK_EXPORT
  BULK_DELETE
  SYSTEM_SETTINGS_CHANGED

  // 비정상 활동
  SUSPICIOUS_ACTIVITY_DETECTED
  RATE_LIMIT_EXCEEDED
  UNAUTHORIZED_ACCESS_ATTEMPT
}
```

## 변경 추적 상세 설계

### 1. 스태프 정보 변경
```typescript
// Before
{ name: "김철수", department: "진료실", role: "STAFF" }

// After
{ name: "김철수", department: "원무과", role: "ADMIN" }

// Audit Log
{
  action: "UPDATE",
  resource: { type: "Staff", id: "staff-123" },
  changes: [
    { field: "department", oldValue: "진료실", newValue: "원무과" },
    { field: "role", oldValue: "STAFF", newValue: "ADMIN" }
  ]
}
```

### 2. 연차 승인/거절
```typescript
{
  action: "UPDATE",
  resource: { type: "LeaveApplication", id: "leave-456" },
  changes: [
    { field: "status", oldValue: "PENDING", newValue: "APPROVED" },
    { field: "approvedBy", oldValue: null, newValue: "user-789" },
    { field: "approvedAt", oldValue: null, newValue: "2025-10-28T10:30:00Z" }
  ],
  reason: "정상적인 승인 절차"
}
```

### 3. 스케줄 삭제
```typescript
{
  action: "DELETE",
  resource: { type: "StaffAssignment", id: "assign-999" },
  snapshot: {
    // 삭제된 데이터 전체 스냅샷
    staffId: "staff-123",
    date: "2025-11-01",
    shiftType: "DAY",
    // ... 전체 데이터
  },
  reason: "관리자 요청에 의한 삭제"
}
```

## 데이터 보존 정책

### 단계별 보존
1. **Hot Storage (90일)**: PostgreSQL - 빠른 검색
2. **Warm Storage (1년)**: 압축 저장 - 정기 감사
3. **Cold Storage (7년)**: 아카이브 - 규정 준수

### 자동 아카이빙
```typescript
// 90일 이상 된 로그를 warm storage로 이동
async function archiveOldLogs() {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 90)

  const oldLogs = await prisma.activityLog.findMany({
    where: { createdAt: { lt: cutoffDate } }
  })

  // S3/Cloud Storage에 압축 저장
  await archiveToCloudStorage(oldLogs)

  // DB에서 삭제 (아카이브 참조만 남김)
  await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: cutoffDate } }
  })
}
```

## 로그 무결성 보장

### 1. 체인 해싱 (Blockchain-like)
각 로그 엔트리에 이전 로그의 해시를 포함:

```typescript
interface AuditLogWithHash {
  id: string
  previousHash: string  // 이전 로그의 해시
  currentHash: string   // 현재 로그의 해시
  content: AuditEntry
  signature: string     // 서명 (변조 방지)
}

function calculateHash(entry: AuditEntry, previousHash: string): string {
  const content = JSON.stringify(entry) + previousHash
  return crypto.createHash('sha256').update(content).digest('hex')
}
```

### 2. 디지털 서명
중요 로그에 대한 서명 추가:

```typescript
function signAuditLog(entry: AuditEntry): string {
  const privateKey = process.env.AUDIT_LOG_PRIVATE_KEY!
  return crypto.sign('sha256', Buffer.from(JSON.stringify(entry)), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING
  })
}
```

## 실시간 알림

### 보안 이벤트 알림
```typescript
const CRITICAL_EVENTS = [
  'UNAUTHORIZED_ACCESS_ATTEMPT',
  'BULK_DELETE',
  'ROLE_CHANGED',
  'ACCOUNT_SUSPENDED'
]

async function handleSecurityEvent(event: SecurityEventType, details: any) {
  if (CRITICAL_EVENTS.includes(event)) {
    // 즉시 관리자에게 알림
    await sendSecurityAlert({
      severity: 'CRITICAL',
      event,
      details,
      timestamp: new Date()
    })
  }
}
```

## 감사 리포트 생성

### 1. 사용자 활동 리포트
```typescript
async function generateUserActivityReport(userId: string, dateRange: DateRange) {
  return {
    user: await getUserInfo(userId),
    period: dateRange,
    summary: {
      totalActivities: 150,
      logins: 45,
      dataChanges: 80,
      sensitiveAccess: 5
    },
    timeline: await getActivityTimeline(userId, dateRange),
    suspiciousActivities: await detectSuspiciousActivities(userId, dateRange)
  }
}
```

### 2. 데이터 변경 리포트
```typescript
async function generateChangeReport(resourceType: string, resourceId: string) {
  const changes = await prisma.activityLog.findMany({
    where: {
      metadata: {
        path: ['resource', 'type'],
        equals: resourceType
      }
    }
  })

  return {
    resource: { type: resourceType, id: resourceId },
    changeHistory: changes.map(c => ({
      timestamp: c.createdAt,
      actor: c.userId,
      changes: c.metadata.changes,
      reason: c.description
    })),
    totalChanges: changes.length,
    lastModified: changes[0]?.createdAt
  }
}
```

## 구현 파일

1. `src/lib/audit/audit-logger.ts` - 감사 로그 기록
2. `src/lib/audit/change-tracker.ts` - 변경 추적
3. `src/lib/audit/security-monitor.ts` - 보안 모니터링
4. `src/lib/audit/archive-manager.ts` - 아카이브 관리
5. `src/app/api/audit/logs/route.ts` - 감사 로그 API
6. `src/app/api/audit/reports/route.ts` - 리포트 API
7. `src/app/(dashboard)/audit/page.tsx` - 감사 대시보드

## 검색 인터페이스

### UI 예시
```
┌─────────────────────────────────────────────┐
│  감사 로그 검색                              │
├─────────────────────────────────────────────┤
│  사용자: [선택]  활동: [전체]               │
│  날짜: [2025-10-01] ~ [2025-10-28]         │
│  리소스: [전체]  보안수준: [전체]           │
│                                  [검색]      │
├─────────────────────────────────────────────┤
│  📊 결과: 1,234건                            │
├─────────────────────────────────────────────┤
│  [2025-10-28 14:30] 김철수 (ADMIN)         │
│  → 연차 신청 승인 (leave-456)               │
│    변경: status: PENDING → APPROVED        │
├─────────────────────────────────────────────┤
│  [2025-10-28 14:25] 이영희 (MANAGER)       │
│  → 스태프 정보 수정 (staff-123)             │
│    변경: department: 진료실 → 원무과        │
└─────────────────────────────────────────────┘
```

## 성능 최적화

### 1. 파티셔닝
날짜별 테이블 파티셔닝:

```sql
CREATE TABLE activity_logs (
  id VARCHAR PRIMARY KEY,
  created_at TIMESTAMP NOT NULL,
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE activity_logs_2025_10 PARTITION OF activity_logs
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

### 2. 인덱싱
```sql
CREATE INDEX idx_activity_user_time
  ON activity_logs (user_id, created_at DESC);

CREATE INDEX idx_activity_resource
  ON activity_logs ((metadata->>'resourceType'), (metadata->>'resourceId'));

CREATE INDEX idx_security_level
  ON activity_logs ((metadata->>'securityLevel'))
  WHERE metadata->>'securityLevel' IN ('high', 'critical');
```

## 규정 준수 체크리스트

- [ ] 모든 개인정보 접근 기록
- [ ] 데이터 수정 이력 7년 보존
- [ ] 삭제 데이터 복구 가능
- [ ] 로그 무결성 보장 (해싱)
- [ ] 관리자 활동 별도 모니터링
- [ ] 정기 감사 리포트 생성
- [ ] 비정상 활동 자동 감지

## 다음 단계

1. ✅ 감사 로그 강화 설계
2. ✅ 변경 추적 미들웨어 구현
3. ✅ 보안 이벤트 모니터링
4. ⏭️ 아카이브 시스템 구축
5. ⏭️ 감사 대시보드 UI

## 참고 자료

- [개인정보보호법](https://www.privacy.go.kr/)
- [의료법 시행규칙](https://www.law.go.kr/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
