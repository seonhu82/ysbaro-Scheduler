# 4차 배치 로직 수정 완료 - 테스트 필요

## 수정 사항

### 1. Schema 변경
- ✅ `ShiftType` enum에 `ANNUAL` 추가 (DAY, NIGHT, OFF, ANNUAL)
- ✅ `StaffAssignment.leaveApplicationId` 필드 추가 및 연결

### 2. 4차 로직 핵심 수정

#### 문제점
기존 4차 로직은 전체 월(11/1~11/30)을 순회하여 배치하지 않은 직원을 OFF로 저장했습니다.
하지만 1~3차는 **이전 달 배포 범위를 제외한 날짜만** 처리합니다.

예:
- 10월 스케줄이 11/1까지 배포됨
- 1~3차는 11/2부터 처리 (10월 배포분 제외)
- 4차가 11/1부터 처리 → **10월 배포 데이터 덮어쓰기** ❌

#### 해결 방법
**1~3차가 배치한 날짜만 추출하여 4차에서 처리**

```typescript
// 1~3차가 배치한 날짜만 추출 (DAY/NIGHT가 있는 날짜)
const assignedDatesRaw = await prisma.staffAssignment.findMany({
  where: {
    scheduleId: schedule.id,
    shiftType: { in: ['DAY', 'NIGHT'] }
  },
  select: { date: true },
  distinct: ['date'],
  orderBy: { date: 'asc' }
})

const assignedDates = assignedDatesRaw.map(d => d.date)

// 1~3차가 배치한 날짜만 순회
for (const currentDate of assignedDates) {
  // 배치되지 않은 직원 처리
}
```

### 3. 4차 로직 기능

#### 배치되지 않은 직원 분류 저장
```typescript
for (const staffId of unassignedStaff) {
  const leave = leaveMap.get(`${staffId}_${dateStr}`)

  if (leave) {
    // 연차 신청 → ANNUAL + leaveApplicationId 연결
    if (leave.leaveType === 'ANNUAL') {
      await prisma.staffAssignment.create({
        data: {
          scheduleId, staffId, date: currentDate,
          shiftType: 'ANNUAL',
          leaveApplicationId: leave.id
        }
      })
    }
    // 오프 신청 → OFF + leaveApplicationId 연결
    else {
      await prisma.staffAssignment.create({
        data: {
          scheduleId, staffId, date: currentDate,
          shiftType: 'OFF',
          leaveApplicationId: leave.id
        }
      })
    }
  } else {
    // 신청 없음 → 순수 OFF
    await prisma.staffAssignment.create({
      data: {
        scheduleId, staffId, date: currentDate,
        shiftType: 'OFF'
      }
    })
  }
}
```

#### 충돌 처리 (근무 배치 vs 연차/오프 신청)
```typescript
for (const assignment of existingAssignments) {
  if (assignment.shiftType === 'DAY' || assignment.shiftType === 'NIGHT') {
    const leave = leaveMap.get(`${assignment.staffId}_${dateStr}`)

    if (leave) {
      // 충돌 발견: 연차/오프 신청을 CANCELLED로 변경
      await prisma.leaveApplication.update({
        where: { id: leave.id },
        data: { status: 'CANCELLED' }
      })

      // 알림 생성
      await prisma.notification.create({
        data: {
          clinicId,
          userId: leave.staffId,
          type: 'LEAVE_CANCELLED',
          title: '연차/오프 신청 자동 취소',
          message: `자동 배치로 인해 ${dateStr} ${leave.leaveType === 'ANNUAL' ? '연차' : '오프'} 신청이 취소되었습니다. (근무 배정됨: ${assignment.shiftType})`
        }
      })
    }
  }
}
```

## 테스트 방법

### 1. 현재 데이터 상태 확인
```bash
node test-complete-flow.js
```

**예상 결과 (수정 전):**
- ANNUAL: 0건
- OFF: ~280건 (모두 leaveApplicationId 없음)
- 확정 연차/오프 신청 vs 근무 배치 충돌: 9건

### 2. UI에서 자동 배치 재실행

1. 웹 UI 로그인
2. 스케줄 관리 페이지 이동
3. 2025년 11월 스케줄 선택
4. "자동 배치" 버튼 클릭

### 3. 결과 확인
```bash
node test-complete-flow.js
```

**예상 결과 (수정 후):**

✅ **ShiftType 분류**
- ANNUAL: ~20건 (확정 연차 신청 반영)
- OFF: ~260건
  - leaveApplicationId 연결됨: ~93건 (확정 오프 신청)
  - leaveApplicationId 없음: ~167건 (순수 OFF)

✅ **날짜 범위**
- 근무 배치 없는 날짜 (OFF/ANNUAL만): 0일
- 모든 날짜에 DAY/NIGHT 근무 존재 (토요일 제외)

✅ **충돌 처리**
- 확정 연차/오프 신청 vs 근무 배치 충돌: 0건
- 충돌 신청은 CANCELLED 상태로 변경됨
- 해당 직원에게 알림 생성됨

✅ **주차별 통계**
- 각 주의 OFF 수: 목표치(40건) 근처
- OFF 비율: 100% 근처 (120-130% ❌ → 100% ✅)

## 현재 상태

- ✅ Schema 변경 완료 (ANNUAL 추가, leaveApplicationId 연결)
- ✅ Migration 완료
- ✅ 4차 로직 코드 수정 완료
- ⏳ **테스트 대기 중** - UI에서 자동 배치 재실행 필요

## 파일 위치

- Schema: `prisma/schema.prisma`
- Migration: `prisma/migrations/20251114081309_add_leave_application_link_to_staff_assignment/`
- Migration: `prisma/migrations/20251114142925_add_annual_shift_type/`
- 자동 배치 로직: `src/app/api/schedule/auto-assign/route.ts` (Line 1710-1859)
- 테스트 스크립트: `test-complete-flow.js`
