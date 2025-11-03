# 자동 배치 로직 개선 TODO

마지막 업데이트: 2025-11-03

## ✅ 완료된 작업

### 1. 동적 형평성 재계산 (2차 배치)
- **위치**: `src/app/api/schedule/auto-assign/route.ts:1100-1165`
- **문제**: 주4일 미달자 추가 배치 시 형평성 점수가 고정되어 있음
- **해결**:
  - 각 배치마다 `calculateStaffFairnessV2` 호출
  - 캐시 무효화로 최신 데이터 반영 (`{ ...fairnessCache, schedule: undefined }`)
  - `offDates.sort()`를 배치 직전에 수행 (동적 재정렬)
- **커밋**: cf2878d

### 2. 관리자 지정 OFF 반영
- **위치**: `src/app/api/schedule/auto-assign/route.ts:950-981`
- **문제**: LeaveApplication의 OFF가 StaffAssignment에 기록되지 않음
- **해결**:
  - `unavailableStaffIds` 중 OFF 직원 추출
  - `allOffStaffIds`에 합쳐서 StaffAssignment 생성
  - 로그에 관리자 지정 수 표시
- **커밋**: cf2878d

### 3. holidayDates 변수 중복 해결
- **위치**: `src/app/api/schedule/auto-assign/route.ts:443-444`
- **해결**:
  - `holidayDatesArray`: getDayType 함수용 (Date[])
  - `holidayDates`: Set 연산용 (Set<string>)
- **커밋**: cf2878d

---

## ❌ 미해결 문제 (현재 발생 중)

### 문제 1: 요일별 OFF 편차가 심함 ⚠️ 우선순위 높음

**증상**:
- 특정 날짜: OFF 2명
- 다른 날짜: OFF 12명
- 요일별로 OFF 인원 편차가 매우 큼

**근본 원인**:
1차 배치 시 날짜별 형평성을 고려하지 않음
- 현재: 직원별 형평성만 고려 (개인이 얼마나 일했는가)
- 필요: 날짜별 형평성도 고려 (특정 날에 너무 많은 사람이 쉬지 않도록)

**해결 방향**:
```
날짜별 필요 인력을 기준으로 OFF를 균등 분배

예시:
- 총 진료실 직원: 20명
- 날짜별 필요 인력: 14명
- 날짜별 OFF 목표: 6명 (20 - 14)

현재는 이 균형이 맞지 않아 어떤 날은 2명, 어떤 날은 12명이 쉼
```

**구현 위치**:
- `src/app/api/schedule/auto-assign/route.ts:750-950` (1차 배치 로직)
- 카테고리별 배치 후 남은 직원 처리 시 날짜별 균형 체크 필요

**예상 수정**:
```typescript
// 각 날짜별 목표 OFF 인원 계산
const targetOffPerDay = new Map<string, number>()
for (const [dateKey, combination] of dateCombinationMap) {
  const required = combination.requiredStaff
  const target = treatmentStaff.length - required
  targetOffPerDay.set(dateKey, target)
}

// 배치 시 목표 OFF 인원 초과하지 않도록 체크
```

---

### 문제 2: 형평성 점수가 마이너스 ⚠️ 우선순위 높음

**증상**:
- deviation이 -4.7, -2 등 마이너스 값
- 이상적으로는 0에 가까워야 함 (공평한 배치)

**근본 원인**:
baseline 계산 공식이 잘못됨

**현재 계산 방식** (`fairness-calculator-v2.ts:202`):
```typescript
const baseline = totalRequired / totalStaffInDepartment
```

- `totalRequired`: 전체 기간의 총 필요 인력 (예: 500명)
- `totalStaffInDepartment`: 전체 직원 수 (예: 20명)
- `baseline`: 500 / 20 = 25일

**문제점**:
1. 연차/오프 사용한 직원도 분모에 포함됨
2. 주4일 제한으로 실제 배치 가능한 슬롯이 더 적음
3. 결과: baseline이 실제보다 높게 계산되어 모든 직원이 "덜 일한" 것처럼 보임

**해결 방향**:
```
실제 배치 가능한 슬롯 수를 기준으로 baseline 계산

예시:
- 총 필요 인력: 500명
- 실제 배치된 슬롯: 450명 (연차, 주4일 제한 등으로 감소)
- 전체 직원: 20명
- 올바른 baseline: 450 / 20 = 22.5일
```

**구현 위치**:
- `src/lib/services/fairness-calculator-v2.ts:111-248` (calculateTotalDimension)
- baseline 계산 로직 수정 필요

**예상 수정**:
```typescript
// 실제 배치된 총 슬롯 수 계산
const actualAssigned = await prisma.staffAssignment.count({
  where: {
    scheduleId: schedule.id,
    date: { gte: startDate, lte: endDate },
    shiftType: { not: 'OFF' }
  }
})

// 수정된 baseline
const baseline = totalStaffInDepartment > 0
  ? actualAssigned / totalStaffInDepartment
  : 0
```

---

## 📝 참고사항

### 테스트 방법
1. 브라우저에서 월간 스케줄 마법사 실행
2. 자동 배치 수행
3. 결과 확인:
   - 각 날짜의 OFF 인원 수 (균등해야 함)
   - 직원별 deviation 점수 (0에 가까워야 함)

### 관련 파일
- `/src/app/api/schedule/auto-assign/route.ts` - 메인 배치 로직
- `/src/lib/services/fairness-calculator-v2.ts` - 형평성 계산
- `/src/components/wizard/Step3AutoAssignment.tsx` - UI (재배치 버튼)

### 참고 스크린샷
- `docs/캡처/20251103_151017.jpg` - 문제 발생 화면
  - 10월 3일: 근무 19명, OFF 0명 (관리자 OFF 누락 - 해결됨 ✅)
  - 요일별 OFF: 2~12명으로 편차 심함 (미해결 ❌)
  - deviation: -4.7, -2 등 마이너스 (미해결 ❌)
