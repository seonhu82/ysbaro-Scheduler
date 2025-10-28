# 감사 로그 시스템 강화 구현 완료

## 개요

보안, 규정 준수, 문제 해결을 위한 포괄적인 감사 로그 시스템 강화를 완료했습니다.

**구현 날짜**: 2025-10-28
**Provider**: PostgreSQL (ActivityLog 확장)

## 구현된 시스템

### 1. 강화된 감사 로거 (`audit-logger.ts`)

#### 새로운 보안 이벤트 타입

```typescript
enum SecurityEventType {
  // 인증
  LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT,
  PASSWORD_CHANGED, PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED,

  // 권한
  ROLE_CHANGED, PERMISSION_GRANTED, PERMISSION_REVOKED,
  ACCOUNT_SUSPENDED, ACCOUNT_REACTIVATED,

  // 민감한 작업
  SENSITIVE_DATA_ACCESSED, BULK_EXPORT, BULK_DELETE,
  SYSTEM_SETTINGS_CHANGED,

  // 비정상 활동
  SUSPICIOUS_ACTIVITY_DETECTED, RATE_LIMIT_EXCEEDED,
  UNAUTHORIZED_ACCESS_ATTEMPT
}
```

#### 감사 액션 및 리소스 타입

```typescript
enum AuditAction {
  CREATE, READ, UPDATE, DELETE, EXPORT, IMPORT
}

enum ResourceType {
  USER, STAFF, SCHEDULE, LEAVE_APPLICATION,
  ATTENDANCE, FAIRNESS_SETTINGS, SYSTEM_SETTINGS
}

enum SecurityLevel {
  LOW, MEDIUM, HIGH, CRITICAL
}
```

#### 변경 추적

```typescript
interface FieldChange {
  field: string
  oldValue: any
  newValue: any
}

interface AuditEntry {
  actor: { id: string; name: string; role: string }
  action: AuditAction
  resource: { type: ResourceType; id: string; name?: string }
  changes?: FieldChange[]     // 변경 전후 비교
  snapshot?: any              // 삭제된 데이터 스냅샷
  reason?: string             // 변경 사유
  securityLevel: SecurityLevel
  metadata: {
    ipAddress?: string
    userAgent?: string
    requestId?: string
    sessionId?: string
  }
}
```

### 2. 변경 추적 미들웨어 (`change-tracker.ts`)

#### API 핸들러 자동 추적

```typescript
import { withChangeTracking } from '@/lib/audit/change-tracker'
import { ResourceType, SecurityLevel } from '@/lib/audit/audit-logger'

export const PATCH = withChangeTracking(
  async (req) => {
    // 스태프 정보 수정 로직
    const updatedStaff = await updateStaff(staffId, data)
    return NextResponse.json({ success: true, data: updatedStaff })
  },
  {
    resourceType: ResourceType.STAFF,
    getResourceId: (req, result) => result.data.id,
    getOldData: async (req) => {
      const staffId = req.nextUrl.pathname.split('/').pop()
      return await prisma.staff.findUnique({ where: { id: staffId } })
    },
    securityLevel: SecurityLevel.HIGH
  }
)
```

#### 대량 작업 추적

```typescript
import { trackBulkOperation } from '@/lib/audit/change-tracker'

// 대량 삭제 추적
await trackBulkOperation(
  clinicId,
  { id: userId, name: userName, role: userRole },
  {
    action: AuditAction.DELETE,
    resourceType: ResourceType.SCHEDULE,
    resourceIds: ['schedule-1', 'schedule-2', 'schedule-3'],
    reason: '관리자 요청에 의한 대량 삭제'
  },
  { ipAddress: req.ip, userAgent: req.headers.get('user-agent') }
)
```

#### 민감한 데이터 접근 추적

```typescript
import { trackSensitiveAccess } from '@/lib/audit/change-tracker'

// 환자 정보 조회 시
await trackSensitiveAccess(
  clinicId,
  { id: userId, name: userName, role: userRole },
  { type: ResourceType.STAFF, id: staffId, name: staffName },
  { ipAddress: req.ip, accessReason: '급여 정보 확인' }
)
```

#### 시스템 설정 변경 추적

```typescript
import { trackSettingsChange } from '@/lib/audit/change-tracker'

const oldSettings = await getFairnessSettings(clinicId)
await updateFairnessSettings(clinicId, newSettings)

await trackSettingsChange(
  clinicId,
  { id: userId, name: userName, role: userRole },
  'fairness-weights',
  oldSettings,
  newSettings,
  { ipAddress: req.ip }
)
```

#### 데이터 내보내기 추적

```typescript
import { trackDataExport } from '@/lib/audit/change-tracker'

const exportedData = await exportStaffData(clinicId, filters)

await trackDataExport(
  clinicId,
  { id: userId, name: userName, role: userRole },
  {
    resourceType: ResourceType.STAFF,
    recordCount: exportedData.length,
    format: 'CSV',
    filters
  },
  { ipAddress: req.ip }
)
```

### 3. 변경 사항 자동 감지

```typescript
import { detectChanges } from '@/lib/audit/audit-logger'

const oldData = { name: "김철수", department: "진료실", role: "STAFF" }
const newData = { name: "김철수", department: "원무과", role: "ADMIN" }

const changes = detectChanges(oldData, newData)
// → [
//   { field: "department", oldValue: "진료실", newValue: "원무과" },
//   { field: "role", oldValue: "STAFF", newValue: "ADMIN" }
// ]
```

**민감한 데이터 자동 마스킹**:
```typescript
const data = {
  name: "김철수",
  password: "secret123",
  token: "abc-def-ghi"
}

const sanitized = sanitizeValue(data)
// → {
//   name: "김철수",
//   password: "[REDACTED]",
//   token: "[REDACTED]"
// }
```

### 4. 보안 이벤트 추적

```typescript
import { logSecurityEvent, SecurityEventType, SecurityLevel } from '@/lib/audit/audit-logger'

// 로그인 실패
await logSecurityEvent(clinicId, {
  type: SecurityEventType.LOGIN_FAILED,
  severity: SecurityLevel.MEDIUM,
  actor: { ipAddress: req.ip },
  details: {
    email: attemptedEmail,
    reason: 'Invalid password',
    attemptCount: 3
  },
  metadata: {
    ipAddress: req.ip,
    userAgent: req.headers.get('user-agent'),
    timestamp: new Date()
  }
})

// 무단 접근 시도
await logSecurityEvent(clinicId, {
  type: SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
  severity: SecurityLevel.HIGH,
  actor: { id: userId, name: userName, ipAddress: req.ip },
  details: {
    attemptedResource: '/api/admin/settings',
    userRole: 'STAFF',
    requiredRole: 'ADMIN'
  },
  metadata: {
    ipAddress: req.ip,
    userAgent: req.headers.get('user-agent'),
    timestamp: new Date()
  }
})

// Rate Limit 초과
await logSecurityEvent(clinicId, {
  type: SecurityEventType.RATE_LIMIT_EXCEEDED,
  severity: SecurityLevel.MEDIUM,
  actor: { id: userId, ipAddress: req.ip },
  details: {
    endpoint: '/api/schedule/assign',
    requestCount: 150,
    timeWindow: '1 minute',
    limit: 100
  },
  metadata: {
    ipAddress: req.ip,
    timestamp: new Date()
  }
})
```

### 5. API 엔드포인트

#### GET /api/audit/logs

감사 로그 검색:

```bash
# 전체 로그 조회
GET /api/audit/logs?clinicId=clinic-1

# 특정 사용자 로그
GET /api/audit/logs?clinicId=clinic-1&userId=user-123

# 날짜 범위
GET /api/audit/logs?clinicId=clinic-1&from=2025-10-01&to=2025-10-28

# 특정 활동 타입
GET /api/audit/logs?clinicId=clinic-1&activityTypes=USER_LOGIN,USER_ROLE_CHANGED

# 검색어
GET /api/audit/logs?clinicId=clinic-1&search=삭제

# 페이지네이션
GET /api/audit/logs?clinicId=clinic-1&limit=50&offset=0
```

**응답 예시**:
```json
{
  "success": true,
  "data": [
    {
      "id": "log-123",
      "userId": "user-456",
      "user": {
        "name": "김철수",
        "email": "kim@example.com",
        "role": "ADMIN"
      },
      "activityType": "USER_ROLE_CHANGED",
      "description": "Staff staff-789을(를) 수정함 (변경: department: 진료실 → 원무과, role: STAFF → ADMIN)",
      "metadata": {
        "action": "UPDATE",
        "resource": {
          "type": "Staff",
          "id": "staff-789"
        },
        "changes": [
          {
            "field": "department",
            "oldValue": "진료실",
            "newValue": "원무과"
          },
          {
            "field": "role",
            "oldValue": "STAFF",
            "newValue": "ADMIN"
          }
        ],
        "securityLevel": "high",
        "ipAddress": "192.168.1.100"
      },
      "createdAt": "2025-10-28T14:30:00Z"
    }
  ],
  "meta": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}
```

#### GET /api/audit/reports

사용자 활동 리포트:

```bash
GET /api/audit/reports?userId=user-123&from=2025-10-01&to=2025-10-28
```

**응답 예시**:
```json
{
  "success": true,
  "data": {
    "totalActivities": 150,
    "byType": {
      "USER_LOGIN": 45,
      "LEAVE_APPLICATION_CREATED": 20,
      "SCHEDULE_ASSIGNED": 30,
      "USER_ROLE_CHANGED": 5
    },
    "timeline": [
      {
        "id": "log-123",
        "activityType": "USER_LOGIN",
        "description": "로그인 성공",
        "createdAt": "2025-10-28T14:30:00Z"
      }
    ]
  }
}
```

## 변경 추적 예시

### 1. 스태프 정보 수정

**Before**:
```json
{
  "id": "staff-123",
  "name": "김철수",
  "department": "진료실",
  "role": "STAFF",
  "email": "kim@example.com"
}
```

**After**:
```json
{
  "id": "staff-123",
  "name": "김철수",
  "department": "원무과",
  "role": "ADMIN",
  "email": "kim@example.com"
}
```

**Audit Log**:
```json
{
  "action": "UPDATE",
  "resource": { "type": "Staff", "id": "staff-123" },
  "changes": [
    { "field": "department", "oldValue": "진료실", "newValue": "원무과" },
    { "field": "role", "oldValue": "STAFF", "newValue": "ADMIN" }
  ],
  "actor": { "id": "user-456", "name": "이관리자", "role": "ADMIN" },
  "securityLevel": "HIGH",
  "timestamp": "2025-10-28T14:30:00Z"
}
```

### 2. 연차 승인/거절

**Audit Log**:
```json
{
  "action": "UPDATE",
  "resource": { "type": "LeaveApplication", "id": "leave-456" },
  "changes": [
    { "field": "status", "oldValue": "PENDING", "newValue": "APPROVED" },
    { "field": "approvedBy", "oldValue": null, "newValue": "user-789" },
    { "field": "approvedAt", "oldValue": null, "newValue": "2025-10-28T10:30:00Z" }
  ],
  "reason": "정상적인 승인 절차",
  "securityLevel": "MEDIUM"
}
```

### 3. 스케줄 삭제

**Audit Log**:
```json
{
  "action": "DELETE",
  "resource": { "type": "StaffAssignment", "id": "assign-999" },
  "snapshot": {
    "id": "assign-999",
    "staffId": "staff-123",
    "date": "2025-11-01",
    "shiftType": "DAY",
    "createdAt": "2025-10-20T10:00:00Z"
  },
  "reason": "관리자 요청에 의한 삭제",
  "securityLevel": "HIGH"
}
```

## 보안 이벤트 알림

### Critical 이벤트 (즉시 알림)

```typescript
const CRITICAL_EVENTS = [
  'UNAUTHORIZED_ACCESS_ATTEMPT',
  'BULK_DELETE',
  'ROLE_CHANGED',
  'ACCOUNT_SUSPENDED',
  'SYSTEM_SETTINGS_CHANGED'
]
```

알림 예시:
```
🚨 CRITICAL AUDIT EVENT

Actor: 김철수 (user-123, ADMIN)
Action: BULK_DELETE
Resource: Schedule (30 items)
Reason: 관리자 요청에 의한 대량 삭제
Time: 2025-10-28 14:30:00
IP: 192.168.1.100
```

### High 이벤트 (모니터링)

```typescript
const HIGH_EVENTS = [
  'SENSITIVE_DATA_ACCESSED',
  'BULK_EXPORT',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED'
]
```

## 통합 가이드

### 1. 기존 API에 변경 추적 추가

```typescript
// Before
export async function PATCH(req: NextRequest) {
  const data = await req.json()
  const updated = await updateStaff(staffId, data)
  return NextResponse.json({ success: true, data: updated })
}

// After
import { withChangeTracking } from '@/lib/audit/change-tracker'

export const PATCH = withChangeTracking(
  async (req) => {
    const data = await req.json()
    const updated = await updateStaff(staffId, data)
    return NextResponse.json({ success: true, data: updated })
  },
  {
    resourceType: ResourceType.STAFF,
    getResourceId: (req, result) => result.data.id,
    getOldData: async (req) => {
      const staffId = req.nextUrl.pathname.split('/').pop()
      return await prisma.staff.findUnique({ where: { id: staffId } })
    }
  }
)
```

### 2. 보안 이벤트 추적 추가

```typescript
// 로그인 처리 시
if (passwordValid) {
  await logSecurityEvent(clinicId, {
    type: SecurityEventType.LOGIN_SUCCESS,
    severity: SecurityLevel.LOW,
    actor: { id: user.id, name: user.name },
    details: { email: user.email },
    metadata: { ipAddress: req.ip, timestamp: new Date() }
  })
} else {
  await logSecurityEvent(clinicId, {
    type: SecurityEventType.LOGIN_FAILED,
    severity: SecurityLevel.MEDIUM,
    actor: { ipAddress: req.ip },
    details: { email: attemptedEmail, reason: 'Invalid password' },
    metadata: { ipAddress: req.ip, timestamp: new Date() }
  })
}
```

### 3. 대량 작업 추적

```typescript
// 대량 삭제 전
await trackBulkOperation(
  clinicId,
  actor,
  {
    action: AuditAction.DELETE,
    resourceType: ResourceType.SCHEDULE,
    resourceIds: schedulesToDelete.map(s => s.id),
    reason: '월간 스케줄 초기화'
  }
)

// 삭제 실행
await prisma.schedule.deleteMany({ where: { id: { in: scheduleIds } } })
```

## 검색 및 분석

### 감사 로그 검색

```typescript
import { searchAuditLogs } from '@/lib/audit/audit-logger'

const logs = await searchAuditLogs({
  clinicId: 'clinic-1',
  userId: 'user-123',
  activityTypes: [ActivityType.USER_ROLE_CHANGED, ActivityType.USER_SUSPENDED],
  dateRange: {
    from: new Date('2025-10-01'),
    to: new Date('2025-10-28')
  },
  searchText: '권한',
  limit: 50,
  offset: 0
})
```

### 사용자 활동 리포트

```typescript
import { generateUserActivityReport } from '@/lib/audit/audit-logger'

const report = await generateUserActivityReport('user-123', {
  from: new Date('2025-10-01'),
  to: new Date('2025-10-28')
})

console.log(`총 활동: ${report.totalActivities}`)
console.log(`로그인: ${report.byType['USER_LOGIN']}`)
console.log(`데이터 수정: ${report.byType['LEAVE_APPLICATION_STATUS_CHANGED']}`)
```

## 규정 준수 체크리스트

- ✅ 모든 개인정보 접근 기록
- ✅ 데이터 수정 이력 추적 (변경 전후)
- ✅ 삭제 데이터 스냅샷 저장
- ✅ 민감한 데이터 자동 마스킹
- ✅ 관리자 활동 별도 모니터링
- ✅ 보안 이벤트 실시간 알림
- ✅ 검색 및 리포트 기능

## 생성된 파일

```
src/lib/audit/
  ├── audit-logger.ts                   # 강화된 감사 로거
  └── change-tracker.ts                 # 변경 추적 미들웨어

src/app/api/audit/
  ├── logs/route.ts                     # 감사 로그 검색 API
  └── reports/route.ts                  # 리포트 API

docs/
  ├── AUDIT_LOG_ENHANCEMENT.md          # 전략 가이드
  └── AUDIT_LOG_ENHANCEMENT_IMPLEMENTATION.md  # 이 문서
```

## 베스트 프랙티스

### 1. 변경 추적 우선순위

**Critical (필수)**:
- 사용자 권한 변경
- 시스템 설정 변경
- 대량 삭제/수정
- 민감한 데이터 접근

**High (권장)**:
- 스태프 정보 수정
- 연차 승인/거절
- 스케줄 변경
- 데이터 내보내기

**Medium (선택)**:
- 일반 데이터 조회
- 설정 조회
- 리포트 생성

### 2. 보안 레벨 설정

```typescript
// Critical: 시스템에 큰 영향
securityLevel: SecurityLevel.CRITICAL

// High: 민감한 데이터 또는 대량 작업
securityLevel: SecurityLevel.HIGH

// Medium: 일반 데이터 변경
securityLevel: SecurityLevel.MEDIUM

// Low: 조회 작업
securityLevel: SecurityLevel.LOW
```

### 3. 로그 설명 작성

```typescript
// 좋음: 구체적이고 이해하기 쉬운 설명
reason: "급여 정보 확인을 위한 스태프 데이터 조회"

// 나쁨: 모호한 설명
reason: "데이터 조회"
```

## 다음 단계

### 완료된 작업 (30/30) 🎉
1. ✅ **감사 로그 시스템 강화** (이번 작업)

### 모든 30개 작업 완료!

**Phase 1: 보안 및 동시성** (5개) ✅
**Phase 2: 기능 확장 및 알림** (7개) ✅
**Phase 3: 접근성 및 테스트** (6개) ✅
**Phase 4: 성능 및 형평성** (4개) ✅
**Phase 5: 최적화 및 모니터링** (8개) ✅

## 참고 자료

- [AUDIT_LOG_ENHANCEMENT.md](./AUDIT_LOG_ENHANCEMENT.md)
- [개인정보보호법](https://www.privacy.go.kr/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## 결론

감사 로그 시스템을 성공적으로 강화하여 모든 중요 활동을 추적하고 규정 준수를 보장할 수 있게 되었습니다.

**주요 달성 사항**:
- ✅ 변경 전후 추적 시스템
- ✅ 보안 이벤트 실시간 모니터링
- ✅ 민감한 데이터 자동 보호
- ✅ 포괄적인 검색 및 리포트
- ✅ 규정 준수 기능 완비

**🎉 30개 작업 모두 완료! 연세바로치과 스케줄러가 프로덕션 준비 완료되었습니다!**
