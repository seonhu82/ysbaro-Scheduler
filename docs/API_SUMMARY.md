# 새로 추가된 API 문서

## 1. 오늘 출퇴근 통계 API

### Endpoint
```
GET /api/attendance/today-stats
```

### 설명
오늘 날짜의 실시간 출퇴근 통계를 조회합니다. 대시보드에서 현재 근무 현황을 모니터링하는데 사용됩니다.

### 인증
- 로그인 필수 (session.user.clinicId 필요)

### 응답 구조
```typescript
{
  success: true,
  data: {
    date: string,                    // 오늘 날짜 (ISO 8601)
    summary: {
      totalScheduled: number,        // 근무 예정 인원
      totalCheckedIn: number,        // 출근한 인원
      totalCheckedOut: number,       // 퇴근한 인원
      currentlyPresent: number,      // 현재 재직 중 인원
      notYetCheckedIn: number,       // 아직 출근하지 않은 인원
      suspiciousCount: number,       // 의심스러운 기록 수
      checkInRate: string            // 출근율 (%)
    },
    notCheckedInList: [              // 미출근 직원 목록
      {
        id: string,
        name: string,
        rank: string | null,
        departmentName: string | null,
        shiftType: 'DAY' | 'NIGHT'
      }
    ],
    recentRecords: [                 // 최근 출퇴근 기록 (최근 10개)
      {
        id: string,
        staffName: string,
        checkType: 'IN' | 'OUT',
        checkTime: string,           // ISO 8601
        isSuspicious: boolean,
        suspiciousReason: string | null
      }
    ],
    byDepartment: [                  // 부서별 통계
      {
        department: string,
        scheduled: number,           // 예정 인원
        checkedIn: number,           // 출근 인원
        present: number,             // 현재 재직 인원
        checkInRate: string          // 출근율 (%)
      }
    ]
  }
}
```

### 사용 예시
```typescript
// 오늘 출퇴근 통계 조회
const response = await fetch('/api/attendance/today-stats')
const { data } = await response.json()

console.log(`출근율: ${data.summary.checkInRate}%`)
console.log(`현재 재직: ${data.summary.currentlyPresent}명`)
```

---

## 2. 스케줄 요약 API

### Endpoint
```
GET /api/schedule/summary?year={year}&month={month}
```

### 설명
특정 월의 스케줄 요약 정보를 조회합니다. 통계, 직원별 근무일수, 일별 현황 등을 포함합니다.

### 인증
- 로그인 필수 (session.user.clinicId 필요)

### Query Parameters
| 파라미터 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|--------|------|
| year | number | X | 현재 연도 | 조회할 연도 |
| month | number | X | 현재 월 | 조회할 월 (1-12) |

### 응답 구조
```typescript
{
  success: true,
  data: {
    period: {
      year: number,
      month: number,
      totalDays: number,             // 해당 월의 총 일수
      startDate: string,             // ISO 8601
      endDate: string                // ISO 8601
    },
    status: 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'DEPLOYED',
    deployedAt: string | null,       // 배포 시간
    summary: {
      totalAssignments: number,      // 전체 배치 수
      dayShiftCount: number,         // 주간 근무 수
      nightShiftCount: number,       // 야간 근무 수
      offShiftCount: number,         // 오프 수
      uniqueStaffCount: number,      // 배치된 직원 수
      uniqueDoctorCount: number,     // 배치된 의사 수
      annualLeaveCount: number,      // 확정된 연차 수
      offLeaveCount: number,         // 확정된 오프 수
      pendingLeaveCount: number,     // 대기 중 신청 수
      onHoldLeaveCount: number       // 보류 중 신청 수
    },
    staffStats: [                    // 직원별 통계
      {
        id: string,
        name: string,
        rank: string | null,
        departmentName: string | null,
        categoryName: string | null,
        dayShifts: number,           // 주간 근무일 수
        nightShifts: number,         // 야간 근무일 수
        offDays: number,             // 오프일 수
        totalDays: number            // 총 근무일 수
      }
    ],
    dailyStats: [                    // 일별 통계
      {
        date: string,                // YYYY-MM-DD
        dayOfWeek: string,           // 요일 (한글)
        dayShifts: number,           // 주간 근무 인원
        nightShifts: number,         // 야간 근무 인원
        offShifts: number,           // 오프 인원
        doctors: string[]            // 근무 의사 목록
      }
    ],
    byDepartment: [                  // 부서별 통계
      {
        department: string,
        staffCount: number,          // 부서 직원 수
        dayShifts: number,           // 주간 근무 수
        nightShifts: number,         // 야간 근무 수
        offDays: number,             // 오프 수
        avgDaysPerStaff: string      // 직원당 평균 근무일
      }
    ]
  }
}
```

### 에러 응답
```typescript
{
  success: false,
  error: 'Schedule not found',
  statusCode: 404
}
```

### 사용 예시
```typescript
// 2025년 11월 스케줄 요약 조회
const response = await fetch('/api/schedule/summary?year=2025&month=11')
const { data } = await response.json()

// 전체 통계
console.log(`총 배치: ${data.summary.totalAssignments}`)
console.log(`직원 수: ${data.summary.uniqueStaffCount}`)

// 직원별 근무일수
data.staffStats.forEach(staff => {
  console.log(`${staff.name}: 총 ${staff.totalDays}일`)
})

// 일별 근무 인원
data.dailyStats.forEach(day => {
  console.log(`${day.date} (${day.dayOfWeek}): ${day.dayShifts}명`)
})
```

---

## 활용 사례

### 대시보드 위젯
```typescript
// 오늘의 출근 현황 위젯
const TodayAttendanceWidget = () => {
  const { data } = useFetch('/api/attendance/today-stats')

  return (
    <div>
      <h3>오늘 출근 현황</h3>
      <p>출근율: {data.summary.checkInRate}%</p>
      <p>현재 재직: {data.summary.currentlyPresent}명</p>
      <p>미출근: {data.summary.notYetCheckedIn}명</p>
    </div>
  )
}

// 월별 스케줄 요약 위젯
const MonthlyScheduleSummaryWidget = () => {
  const { data } = useFetch('/api/schedule/summary?year=2025&month=11')

  return (
    <div>
      <h3>11월 스케줄 요약</h3>
      <p>총 배치: {data.summary.totalAssignments}</p>
      <p>직원 수: {data.summary.uniqueStaffCount}</p>
      <p>평균 근무일: {(data.summary.totalAssignments / data.summary.uniqueStaffCount).toFixed(1)}</p>
    </div>
  )
}
```

---

## 구현 위치
- `/src/app/api/attendance/today-stats/route.ts` - 오늘 출퇴근 통계 API
- `/src/app/api/schedule/summary/route.ts` - 스케줄 요약 API

## 의존성
- `@/lib/auth` - 인증 처리
- `@/lib/prisma` - 데이터베이스 접근
- `@/lib/utils/api-response` - 표준 응답 포맷

## 데이터베이스 모델
- `AttendanceRecord` - 출퇴근 기록
- `StaffAssignment` - 직원 스케줄 배치
- `Schedule` - 월별 스케줄
- `Staff` - 직원 정보
- `LeaveApplication` - 연차/오프 신청
