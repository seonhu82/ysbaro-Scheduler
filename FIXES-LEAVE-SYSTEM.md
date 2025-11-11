# 연차/오프 신청 시스템 수정 사항 (2025-11-11)

## 문제점 요약

연차/오프 신청 시스템에서 "NO_SCHEDULE" 오류와 여러 Prisma 필드명 오류가 발생했습니다.

## 핵심 시스템 이해

### 데이터 생성 흐름
1. **원장 스케줄 배치** (ScheduleDoctor) - 마법사 1단계
2. **직원 연차/오프 신청** (LeaveApplication) - 직원이 직접 신청
3. **자동 배치** (DailySlot, StaffAssignment) - 마법사 3단계

### 핵심 개념
- DailySlot과 WeekInfo는 **자동 배치 단계(3단계)**에서 생성됨
- 연차/오프 신청은 **2단계**에서 일어남
- 따라서 신청 검증 시 DailySlot을 참조할 수 없음
- **ScheduleDoctor + DoctorCombination**을 사용해야 함

## 수정 사항

### 1. leave-eligibility-simulator.ts - checkCategoryRequirement 함수

**문제**: DailySlot을 참조하려고 했으나 존재하지 않음

**해결**: ScheduleDoctor → DoctorCombination 방식으로 변경

```typescript
// 이전: DailySlot 조회 (존재하지 않음)
const dailySlot = await prisma.dailySlot.findFirst({
  where: { date: leaveDate, week: { clinicId } }
})

// 수정: ScheduleDoctor 조회
const scheduleDoctors = await prisma.scheduleDoctor.findMany({
  where: {
    date: leaveDate,
    schedule: { clinicId, year, month }
  },
  include: {
    doctor: { select: { id: true, shortName: true } }
  },
  orderBy: { doctorId: 'asc' }
})

// 원장 이름 배열로 DoctorCombination 조회
const doctorNames = scheduleDoctors.map(sd => sd.doctor.shortName).sort()
const doctorCombination = await prisma.doctorCombination.findFirst({
  where: {
    clinicId,
    doctors: { equals: doctorNames }
  }
})

const requiredStaff = doctorCombination.requiredStaff
```

**파일**: `src/lib/services/leave-eligibility-simulator.ts`
**라인**: 188-305

### 2. Prisma 필드명 오류 수정 (type → leaveType)

**문제**: LeaveApplication 모델의 필드명이 `leaveType`인데 `type`으로 잘못 사용

**수정한 파일들**:

#### 2-1. fairness-based-leave-calculator.ts
```typescript
// 이전
type: 'OFF',

// 수정
leaveType: 'OFF',
```
**라인**: 130

#### 2-2. can-apply/route.ts (2곳)
```typescript
// 연차 신청 수 확인
leaveType: 'ANNUAL',  // line 108

// 오프 신청 수 확인
leaveType: 'OFF',     // line 178
```

#### 2-3. leave-eligibility-simulator.ts
```typescript
// 형평성 체크에서 오프 수 확인
leaveType: 'OFF',     // line 333
```

### 3. weekBusinessDays 필드 위치 수정

**문제**: Clinic 모델에 `weekBusinessDays`와 `defaultWorkDays` 필드가 없음

**원인**: 해당 필드들은 `RuleSettings` 모델에 있음

**수정**: statistics/route.ts
```typescript
// 이전
const clinic = await prisma.clinic.findUnique({
  where: { id: link.clinicId },
  select: {
    weekBusinessDays: true,
    defaultWorkDays: true,
  }
})

// 수정
const ruleSettings = await prisma.ruleSettings.findUnique({
  where: { clinicId: link.clinicId },
  select: {
    weekBusinessDays: true,
    defaultWorkDays: true,
  }
})
```

**파일**: `src/app/api/leave-apply/[token]/statistics/route.ts`
**라인**: 58-67

## Prisma 스키마 참고

### LeaveApplication 모델
```prisma
model LeaveApplication {
  id         String            @id @default(cuid())
  clinicId   String
  linkId     String
  staffId    String
  date       DateTime          @db.Date
  leaveType  LeaveType         // ✅ 올바른 필드명
  status     ApplicationStatus @default(PENDING)
  // ...
}
```

### RuleSettings 모델
```prisma
model RuleSettings {
  id               String @id @default(cuid())
  clinicId         String @unique
  weekBusinessDays Int    @default(6)  // ✅ 여기에 있음
  defaultWorkDays  Int    @default(4)  // ✅ 여기에 있음
  // ...
}
```

## 테스트 결과

- ✅ 서버 정상 실행 (포트 3000)
- ✅ Prisma 필드명 오류 해결
- ✅ NO_SCHEDULE 오류 해결 (ScheduleDoctor 기반으로 검증)
- ✅ 구분별 슬롯 계산 정상 작동

## 참고 데이터

### 11월 데이터 상태
- Schedule: ✅ 존재
- ScheduleDoctor: ✅ 62개 레코드
- DailySlot/WeekInfo: ❌ 없음 (자동 배치 전이므로 정상)
- DoctorCombination: ✅ 설정됨 (예: ["박", "황"] = 14명)

### 11월 21일 예시
- 원장: 박, 황 (2명)
- 필요 직원: 14명 (DoctorCombination에서 조회)
- 구분별 슬롯 계산: calculateCategorySlots 함수 사용

## 전체 시스템 참고용

### 신청 가능 여부 검증 단계
1. **주4일 제약** (checkWeek4DayConstraint)
   - 해당 주의 평일 수 계산
   - 공휴일 수 확인
   - 이미 신청한 OFF 수 확인
   - 근무 가능일 >= 4일 검증

2. **구분별 필수 인원** (checkCategoryRequirement)
   - ScheduleDoctor 조회
   - DoctorCombination으로 필요 직원 수 확인
   - calculateCategorySlots로 구분별 슬롯 계산
   - 신청 가능 슬롯 확인

3. **형평성 편차** (checkFairnessDeviation)
   - fairnessScoreTotalDays 기반 계산
   - 부서 평균 편차와 비교
   - 최대 신청 가능 일수 계산

## 결론

모든 Prisma 필드명 오류를 수정하고, DailySlot 대신 ScheduleDoctor를 사용하도록 변경하여 시스템이 정상 작동하도록 수정했습니다. 이제 연차/오프 신청 시 올바른 데이터를 참조하여 검증이 이루어집니다.
