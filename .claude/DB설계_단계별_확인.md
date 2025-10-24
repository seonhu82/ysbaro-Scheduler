# DB 설계 - 단계별 확인 문서

**작성일**: 2025-10-22
**목적**: 페이지/기능별로 테이블 설계 확인

---

## ✅ 1. 직원 관리 페이지

### 페이지: `/settings/staff`

### 저장할 데이터

#### 직원 기본 정보
- 이름
- 직급 (RANK): 위생사, 어시스턴트, 코디, 간호 등
- ⭐ **배치 구분 (CATEGORY)**: 실팀장, 고년차, 중년차, 저년차 등
  - 복수 선택 가능 (예: 고년차 + 중년차)
  - 자동 배치 시 두 구분 비율에 따라 배정
- 전화번호
- 이메일

#### 근무 정보
- 생년월일 (필수)
- 입사일 (필수)
- 주당 근무일수 (기본값: 설정의 defaultWorkDays)
- PIN 6자리 (초기: 생년월일 YYMMDD)

#### 연차 정보
- 총 연차 일수 (근속 연수 기반 자동 계산)
- 사용한 연차 일수 (올해)

#### 보안 정보
- 등록된 기기 (JSON)

---

## 📋 테이블 설계

### Staff 모델

```prisma
model Staff {
  id                 String              @id @default(cuid())
  clinicId           String
  clinic             Clinic              @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  // 기본 정보
  name               String
  rank               StaffRank           // 직급: 위생사, 어시스턴트, 코디, 간호
  categories         String[]            // ⭐ 배치 구분 (복수): ["고년차", "중년차"]
  phoneNumber        String?
  email              String?

  // 근무 정보
  birthDate          DateTime            // 생년월일 (필수)
  hireDate           DateTime            // 입사일 (필수)
  workDays           Int                 @default(4)     // 주당 근무일수
  pin                String              // 6자리 PIN

  // 연차 정보
  totalAnnualDays    Int                 @default(15)    // 총 연차 일수
  usedAnnualDays     Int                 @default(0)     // 사용한 연차 일수

  // 보안 정보
  registeredDevices  Json?               // 등록된 기기 목록

  isActive           Boolean             @default(true)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  // 관계
  assignments        StaffAssignment[]
  leaveApplications  LeaveApplication[]
  fairnessScores     FairnessScore[]
  attendanceRecords  AttendanceRecord[]

  @@index([clinicId])
  @@index([pin])
}
```

### RuleSettings 모델 (확장)

```prisma
model RuleSettings {
  id                     String   @id @default(cuid())
  clinicId               String   @unique
  clinic                 Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  // ⭐ 주 영업일 및 근무일 기본값
  weekBusinessDays       Int      @default(6)    // 주 영업일 (1~7)
  defaultWorkDays        Int      @default(4)    // 신규 직원 기본 근무일수

  // ⭐ 배치 구분 설정 (사용자 정의)
  staffCategories        String[] @default(["실팀장", "고년차", "중년차", "저년차"])
  // 관리자가 추가/수정 가능: ["구분1", "구분2", "구분3", "구분4", ...]

  // 오프 관련 규칙
  maxWeeklyOffs          Int      @default(2)
  preventSundayOff       Boolean  @default(true)
  preventHolidayOff      Boolean  @default(true)

  // 근무 관련 규칙
  maxConsecutiveNights   Int      @default(3)
  minRestAfterNight      Int      @default(1)

  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}
```

---

## 🔍 배치 구분 (Category) 설계

### 개념
- **직급 (Rank)**: 고정된 enum (위생사, 어시스턴트, 코디, 간호)
- **배치 구분 (Category)**: 사용자 정의 가능, 복수 선택 가능

### 사용 시나리오

#### 1. 단일 구분
```typescript
staff = {
  name: "김유진",
  rank: "HYGIENIST",
  categories: ["고년차"],  // 고년차 전용
}

// 자동 배치 시: 고년차 슬롯에만 배치
```

#### 2. 복수 구분
```typescript
staff = {
  name: "이소영",
  rank: "ASSISTANT",
  categories: ["고년차", "중년차"],  // 고년차 + 중년차 겸용
}

// 자동 배치 시: 고년차 슬롯 또는 중년차 슬롯에 배치 가능
// 우선순위: 배열 순서 (고년차 우선, 부족하면 중년차)
```

### 배치 구분 관리

#### 설정 페이지에서 관리
```typescript
// /settings/rules

staffCategories 설정:
- 구분 1: [입력] 실팀장
- 구분 2: [입력] 고년차
- 구분 3: [입력] 중년차
- 구분 4: [입력] 저년차
- [추가] 버튼 (5번째 구분 추가)

저장하면 → RuleSettings.staffCategories 업데이트
```

#### 직원 추가/수정 시
```typescript
// /settings/staff

배치 구분 선택:
☑ 실팀장
☑ 고년차
☐ 중년차
☐ 저년차

// 체크된 항목들이 staff.categories에 배열로 저장
```

---

## 💡 자동 배치 로직 (예시)

```typescript
// src/lib/algorithms/auto-assign.ts

function assignStaffToDate(
  date: Date,
  requiredStaff: {
    "실팀장": 1,
    "고년차": 4,
    "중년차": 5,
    "저년차": 4
  }
) {
  const availableStaff = getAvailableStaff(date);
  const assigned = [];

  // 각 구분별로 배치
  for (const [category, count] of Object.entries(requiredStaff)) {
    // 해당 구분을 가진 직원 필터링
    const candidates = availableStaff.filter(staff =>
      staff.categories.includes(category)
    );

    // 우선순위: 카테고리 배열에서 첫 번째가 해당 구분인 직원 우선
    candidates.sort((a, b) => {
      const aIndex = a.categories.indexOf(category);
      const bIndex = b.categories.indexOf(category);
      return aIndex - bIndex;
    });

    // 필요 인원수만큼 배치
    for (let i = 0; i < count && i < candidates.length; i++) {
      assigned.push(candidates[i]);
    }
  }

  return assigned;
}
```

---

## ✅ 확정된 내용

### 1. Staff 테이블
- ✅ `categories: String[]` - 배치 구분 (복수 선택)
- ✅ `birthDate: DateTime` - 생년월일 (필수)
- ✅ `hireDate: DateTime` - 입사일 (필수)
- ✅ `workDays: Int` - 주당 근무일수 (기본값: 설정에서)
- ✅ `pin: String` - 6자리 PIN
- ✅ `totalAnnualDays: Int` - 총 연차
- ✅ `usedAnnualDays: Int` - 사용 연차
- ✅ `registeredDevices: Json` - 등록 기기

### 2. RuleSettings 테이블
- ✅ `weekBusinessDays: Int` - 주 영업일 (1~7)
- ✅ `defaultWorkDays: Int` - 기본 근무일수
- ✅ `staffCategories: String[]` - 배치 구분 목록 (사용자 정의)

---

---

## ✅ 2. 연차/오프 신청 페이지

### 페이지: `/leave-apply/[token]` (공개 페이지)

### 저장할 데이터

#### 연차/오프 신청 정보
- 신청 직원 (staffId)
- 신청 날짜 (date)
- 신청 유형 (leaveType): ANNUAL(연차) / OFF(오프)
- 신청 상태 (status): PENDING(대기), APPROVED(승인), REJECTED(거부)
- 신청 링크 (linkId) - 어느 신청 기간에 제출되었는지
- 신청 시간 (createdAt)

#### 인증 정보
- 생년월일 (Staff.birthDate와 대조)
- ⚠️ PIN 번호 - **현재 4자리로 구현되어 있으나 6자리로 변경 필요**

#### 실시간 슬롯 현황 (조회용)
- 날짜별 사용 가능 슬롯 수
- 주별 오프 신청 현황 (주당 최대 2회 제한)
- 공휴일 여부

---

## ✅ 3. 연차 관리 대시보드

### 페이지: `/leave-management` (관리자 전용)

### 4개 탭별 기능

#### 1) 신청 기간 관리 탭
- 신청 링크 생성/삭제
- 신청 기간 설정 (년도, 시작일, 종료일)
- QR 코드 표시
- 링크 URL 복사

#### 2) 달력뷰 탭
- 월별 캘린더에 신청 내역 표시
- 날짜별 슬롯 사용 현황
- 승인/거부 버튼

#### 3) 목록뷰 탭
- 신청 내역 테이블 (날짜순 정렬)
- 필터: 상태(대기/승인/거부), 유형(연차/오프), 직원
- 일괄 승인/거부

#### 4) 직원별뷰 탭
- 직원별 연차 사용 현황
- 총 연차 / 사용 연차 / 남은 연차
- 오프 신청 현황

---

## 📋 테이블 설계 (연차 관련)

### LeaveApplication 모델 (기존)

```prisma
model LeaveApplication {
  id           String            @id @default(cuid())
  clinicId     String
  clinic       Clinic            @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  linkId       String
  link         ApplicationLink   @relation(fields: [linkId], references: [id], onDelete: Cascade)

  staffId      String
  staff        Staff             @relation(fields: [staffId], references: [id], onDelete: Cascade)

  date         DateTime          @db.Date
  leaveType    LeaveType         // ANNUAL | OFF
  status       ApplicationStatus @default(PENDING)  // PENDING | APPROVED | REJECTED

  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  @@index([clinicId])
  @@index([linkId])
  @@index([staffId])
  @@index([date])
  @@index([status])
}
```

### ApplicationLink 모델 (확인 필요)

```prisma
model ApplicationLink {
  id                  String              @id @default(cuid())
  clinicId            String
  clinic              Clinic              @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  token               String              @unique
  year                Int
  startDate           DateTime            @db.Date
  endDate             DateTime            @db.Date
  isActive            Boolean             @default(true)

  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  // 관계
  leaveApplications   LeaveApplication[]

  @@index([clinicId])
  @@index([token])
  @@index([year])
}
```

---

## 🔍 연차 신청 프로세스

### 1. 인증 단계
```typescript
// 직원이 생년월일과 PIN 입력
POST /api/leave-apply/[token]/auth
{
  birthDate: "19900101",
  pin: "900101"  // ⚠️ 6자리로 변경 필요 (현재 4자리)
}

// 응답
{
  success: true,
  staffId: "...",
  staffName: "...",
  remainingAnnual: 12  // 남은 연차 일수
}
```

### 2. 슬롯 현황 조회
```typescript
// 선택한 날짜의 슬롯 현황
GET /api/leave-apply/[token]/slot-status?date=2025-11-01

{
  date: "2025-11-01",
  available: 2,      // 사용 가능한 슬롯
  total: 14,         // 전체 슬롯
  isHoliday: false,
  weeklyOffCount: 1  // 이번 주 오프 신청 수
}
```

### 3. 신청 제출
```typescript
POST /api/leave-apply/[token]/submit
{
  staffId: "...",
  date: "2025-11-01",
  type: "ANNUAL"  // or "OFF"
}

// 검증 사항:
// 1. 연차인 경우: staff.totalAnnualDays - staff.usedAnnualDays > 0
// 2. 오프인 경우: 이번 주 오프 신청 < 2
// 3. 슬롯 여유 확인
// 4. 중복 신청 방지
```

---

## ✅ 확정된 내용

### 1. LeaveApplication 테이블
- ✅ 현재 schema.prisma에 정의되어 있음
- ✅ 필요한 필드 모두 포함됨
- ✅ 인덱스 적절히 설정됨

### 2. ApplicationLink 테이블
- ⚠️ **확인 필요**: schema.prisma에 존재하는지 확인 필요
- 필요한 필드:
  - token (unique)
  - year, startDate, endDate
  - isActive

### 3. 인증 방식
- ⚠️ **변경 필요**: PIN을 4자리 → 6자리로 변경
- UI와 API 모두 수정 필요

---

---

## ✅ 4. 스케줄 작성 페이지

### 페이지: `/calendar` (관리자 전용)

### 핵심 개념: 주별(Weekly) 슬롯 계산

#### ⚠️ 중요한 설계 변경 사항
- **현재 DB**: `SlotLimit` 테이블은 **일별(daily)** 기반
- **요구사항**: **주별(weekly)** 기반으로 변경 필요
- **이유**: 직원들의 주당 근무일수(4일) 기반 관리

### 저장할 데이터

#### 주차 정보 (새로운 테이블 필요)
- 주차 번호 (weekNumber)
- 주 시작일 (월요일)
- 주 종료일 (토요일)
- 년도/월 정보
- 총 슬롯 수 (total_slots)
- 오프 목표 수 (off_target)
- 연차 가능 수 (annual_available)
- 공휴일 포함 여부 (has_holiday)

#### 날짜별 슬롯 정보 (기존 개선)
- 날짜 (date)
- 요일 타입 (dayType): WEEKDAY / SATURDAY / SUNDAY
- 필요 배치 인원 (required_staff)
- 휴무 가능 자리 (available_slots = 20 - required_staff)
- 원장 조합 정보 (doctor_schedule JSON)

#### 원장 스케줄 정보
- 원장 이름들 (doctors[])
- 야간 진료 여부 (night_shift)

---

## 📋 테이블 설계 (스케줄 관련)

### ⚠️ 문제점: 현재 SlotLimit 테이블 (일별 기반)

```prisma
// ❌ 현재 구조 - 일별 기반 (변경 필요)
model SlotLimit {
  id              String          @id @default(cuid())
  linkId          String
  link            ApplicationLink @relation(fields: [linkId], references: [id], onDelete: Cascade)

  date            DateTime        @db.Date
  dayType         DayType
  maxSlots        Int             // 최대 인원
  currentSlots    Int             @default(0)

  @@unique([linkId, date])
  @@index([linkId])
  @@index([date])
}
```

**문제점**:
1. 주별 총계 계산이 없음
2. 오프/연차 구분 로직이 명확하지 않음
3. 주당 근무일 4일 개념이 반영 안됨

---

### ✅ 제안: 주별 기반 테이블 구조

```prisma
// 주차 정보 테이블 (새로 추가)
model WeekInfo {
  id                  String          @id @default(cuid())
  clinicId            String
  clinic              Clinic          @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  year                Int
  month               Int
  weekNumber          Int             // 해당 월의 주차 (1, 2, 3, ...)
  weekStart           DateTime        @db.Date  // 월요일
  weekEnd             DateTime        @db.Date  // 토요일

  // 주별 슬롯 계산 결과
  totalSlots          Int             // 주당 총 휴무 가능 자리 (평일6 + 토요일14 등)
  offTarget           Int             // 오프 배정 목표 (보통 20명 × 2일 = 40자리)
  annualAvailable     Int             // 연차 가능 자리 (total - off)
  hasHoliday          Boolean         @default(false)  // 주 중 휴무일 포함 여부

  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  // 관계
  dailySlots          DailySlot[]

  @@unique([clinicId, year, month, weekNumber])
  @@index([clinicId])
  @@index([year, month])
}

// 날짜별 슬롯 정보 테이블 (개선)
model DailySlot {
  id                  String          @id @default(cuid())
  weekId              String
  week                WeekInfo        @relation(fields: [weekId], references: [id], onDelete: Cascade)

  date                DateTime        @db.Date
  dayType             DayType         // WEEKDAY / SATURDAY / SUNDAY

  // 원장 스케줄
  doctorSchedule      Json            // { doctors: [...], night_shift: true }

  // 슬롯 계산
  requiredStaff       Int             // 필요 배치 인원 (14 or 6)
  availableSlots      Int             // 휴무 가능 자리 (20 - required)

  // 사용 현황
  offAssigned         Int             @default(0)  // 배정된 오프
  annualAssigned      Int             @default(0)  // 배정된 연차

  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@unique([weekId, date])
  @@index([weekId])
  @@index([date])
}

enum DayType {
  WEEKDAY      // 평일 (월-금)
  SATURDAY     // 토요일
  SUNDAY       // 일요일 (전원 휴무)
}
```

---

## 🔍 주별 슬롯 계산 로직

### 계산 순서

```typescript
// 1. 월의 주차 계산
function getMonthWeeks(year: number, month: number): WeekRange[] {
  // 해당 월의 첫날/마지막날이 속한 주 포함
  // 일요일은 건너뛰고 월-토만 주차에 포함
}

// 2. 각 주차의 슬롯 계산
function calculateWeekSlots(weekStart: Date, weekEnd: Date): WeekSlotInfo {
  let totalSlots = 0;
  let hasHoliday = false;
  const dailySlots = [];

  for (let date = weekStart; date <= weekEnd; date++) {
    if (isSunday(date)) {
      hasHoliday = true;
      continue;
    }

    const requiredStaff = getRequiredStaff(date);  // 원장 조합 기반
    const availableSlots = 20 - requiredStaff;

    totalSlots += availableSlots;
    dailySlots.push({ date, availableSlots, requiredStaff });
  }

  // 오프 목표: 20명 × 주당 오프 2일 = 40자리
  // 휴무일 있으면 20명만 오프 (1일분)
  const offTarget = hasHoliday ? 20 : 40;
  const annualAvailable = totalSlots - offTarget;

  return { totalSlots, offTarget, annualAvailable, hasHoliday, dailySlots };
}

// 3. DB 저장
async function saveWeekSchedule(year: number, month: number) {
  const weeks = getMonthWeeks(year, month);

  for (const weekRange of weeks) {
    const slotInfo = calculateWeekSlots(weekRange.start, weekRange.end);

    // WeekInfo 생성
    const weekInfo = await prisma.weekInfo.create({
      data: {
        clinicId,
        year,
        month,
        weekNumber: weekRange.weekNumber,
        weekStart: weekRange.start,
        weekEnd: weekRange.end,
        totalSlots: slotInfo.totalSlots,
        offTarget: slotInfo.offTarget,
        annualAvailable: slotInfo.annualAvailable,
        hasHoliday: slotInfo.hasHoliday,
      }
    });

    // DailySlot 생성
    for (const daily of slotInfo.dailySlots) {
      await prisma.dailySlot.create({
        data: {
          weekId: weekInfo.id,
          date: daily.date,
          dayType: getDayType(daily.date),
          doctorSchedule: daily.doctorSchedule,
          requiredStaff: daily.requiredStaff,
          availableSlots: daily.availableSlots,
        }
      });
    }
  }
}
```

---

## 💡 주별 계산 예시

### 2025년 1월 첫째 주

```
주차: 2024-12-30 (월) ~ 2025-01-04 (토)

날짜별 슬롯:
- 12/30 (월): 원장3명+야간 → 14명 필요 → 6자리
- 12/31 (화): 원장3명+야간 → 14명 필요 → 6자리
- 01/01 (수): 공휴일 (설 연휴) → 전원 휴무 → hasHoliday = true
- 01/02 (목): 원장3명+야간 → 14명 필요 → 6자리
- 01/03 (금): 원장3명+야간 → 14명 필요 → 6자리
- 01/04 (토): 원장2명 → 6명 필요 → 14자리

총 슬롯: 6 + 6 + 0 + 6 + 6 + 14 = 38자리
오프 목표: 20자리 (휴무일 있음)
연차 가능: 38 - 20 = 18자리
```

---

## ✅ 확정 필요 사항

### 1. ApplicationLink 테이블 수정
- ⚠️ **현재**: month, year 필드 있음
- ⚠️ **필요**: startDate, endDate 추가 필요 (기간 설정용)

### 2. SlotLimit → WeekInfo + DailySlot 변경
- ⚠️ **중대한 스키마 변경**
- 기존 데이터 마이그레이션 필요
- ApplicationLink와의 관계 재설정 필요

### 3. 주별 계산 알고리즘
- ✅ 문서에 로직 정의되어 있음 (docs/스케줄_시스템_개발_주의사항.md)
- 구현 파일: `src/lib/algorithms/week-slots-calculator.ts` (placeholder 생성됨)

---

---

## ✅ 5. 로그인 및 인증 시스템

### 페이지: `/login`, `/forgot-password`, `/reset-password`

### 워크플로우

#### 1) 로그인 플로우
```
사용자 → 이메일/비밀번호 입력
       → NextAuth Credentials Provider 인증
       → User 테이블에서 이메일 조회
       → bcrypt로 비밀번호 검증
       → JWT 토큰 생성 (세션 유지)
       → /calendar 페이지로 리다이렉트
```

#### 2) 비밀번호 찾기 플로우 (⚠️ 미구현)
```
사용자 → 이메일 입력
       → 이메일 존재 여부 확인
       → 재설정 토큰 생성 (유효기간: 1시간)
       → PasswordResetToken 테이블에 저장
       → 이메일 발송 (재설정 링크 포함)
       → 사용자가 이메일 링크 클릭
       → /reset-password/[token] 페이지 접근
       → 토큰 유효성 검증
       → 새 비밀번호 입력
       → User.password 업데이트 (bcrypt 해싱)
       → PasswordResetToken 삭제
       → 로그인 페이지로 리다이렉트
```

#### 3) 최초 설정 플로우 (⚠️ 미구현)
```
시스템 설치 → Clinic 테이블 확인
            → Clinic 없으면 /setup 페이지로 리다이렉트
            → 병원 정보 + 관리자 계정 생성
            → Clinic 생성
            → User 생성 (role: ADMIN)
            → 기본 RuleSettings 생성
            → /login 페이지로 리다이렉트
```

---

## 📋 테이블 설계 (인증 관련)

### User 모델 (기존 - 확인됨)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  password      String   // bcrypt 해싱
  name          String
  role          UserRole @default(STAFF)
  clinicId      String?
  clinic        Clinic?  @relation(fields: [clinicId], references: [id])

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // 관계
  notifications       Notification[]
  activityLogs        ActivityLog[]
  passwordResetTokens PasswordResetToken[]  // ⚠️ 추가 필요

  @@index([clinicId])
  @@index([email])
}

enum UserRole {
  ADMIN      // 관리자 (모든 권한)
  MANAGER    // 매니저 (스케줄 작성, 연차 관리)
  STAFF      // 일반 직원 (조회만)
}
```

### PasswordResetToken 모델 (⚠️ 새로 추가 필요)

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  token     String   @unique      // UUID 또는 랜덤 토큰
  expiresAt DateTime              // 만료 시간 (생성 시간 + 1시간)
  used      Boolean  @default(false)  // 사용 여부

  createdAt DateTime @default(now())

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}
```

### NextAuth Session 관리

NextAuth v5는 **JWT 전략**을 사용하여 세션을 관리합니다:
- Database Session 테이블 **불필요**
- JWT 토큰에 사용자 정보 저장
- 토큰은 암호화되어 쿠키에 저장
- 로그인 유지는 JWT 만료 시간으로 제어

현재 설정 (src/lib/auth.ts):
```typescript
session: {
  strategy: 'jwt',  // JWT 전략 사용
}

// JWT에 포함되는 정보:
// - user.id
// - user.email
// - user.name
// - user.role
// - user.clinicId
// - user.clinicName
```

---

## 🔍 로그인 관련 API 엔드포인트

### 현재 구현됨 ✅
```typescript
// NextAuth 핸들러
POST /api/auth/signin/credentials
POST /api/auth/signout

// 커스텀 엔드포인트 (필요시)
GET  /api/auth/session  // 현재 세션 조회
```

### 구현 필요 ⚠️
```typescript
// 비밀번호 찾기
POST /api/auth/forgot-password
{
  email: string
}
// → PasswordResetToken 생성
// → 이메일 발송

// 비밀번호 재설정
POST /api/auth/reset-password
{
  token: string,
  newPassword: string
}
// → 토큰 검증 (유효성, 만료 시간, 사용 여부)
// → User.password 업데이트
// → PasswordResetToken.used = true

// 최초 설정
POST /api/setup
{
  clinicName: string,
  address: string,
  phone: string,
  adminEmail: string,
  adminPassword: string,
  adminName: string
}
// → Clinic 생성
// → User 생성 (ADMIN)
// → RuleSettings 생성
```

---

## 🔍 이메일 발송 기능

### 비밀번호 재설정 이메일 템플릿

```typescript
// src/lib/email/reset-password.ts

interface SendResetEmailParams {
  to: string;
  token: string;
  userName: string;
}

async function sendPasswordResetEmail({ to, token, userName }: SendResetEmailParams) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

  const emailContent = `
    안녕하세요, ${userName}님

    비밀번호 재설정을 요청하셨습니다.
    아래 링크를 클릭하여 비밀번호를 재설정하세요.

    ${resetUrl}

    이 링크는 1시간 동안 유효합니다.

    요청하지 않으셨다면 이 이메일을 무시하세요.

    연세바로치과 스케줄 시스템
  `;

  // TODO: 이메일 전송 라이브러리 선택 필요
  // 옵션 1: nodemailer
  // 옵션 2: SendGrid
  // 옵션 3: AWS SES
  // 옵션 4: Resend
}
```

---

## 🔐 보안 고려사항

### 1. 비밀번호 정책
- ✅ **bcrypt 해싱** 적용됨 (src/lib/auth.ts:4)
- ⚠️ **비밀번호 강도 검증** 필요
  - 최소 8자 이상
  - 영문 대소문자, 숫자, 특수문자 조합
  - 회원가입/비밀번호 변경 시 검증

### 2. 토큰 보안
- ✅ **JWT Secret** 환경변수 사용 (NEXTAUTH_SECRET)
- ⚠️ **재설정 토큰** 보안
  - UUID v4 사용 (예측 불가능)
  - 1시간 만료
  - 1회만 사용 가능
  - 사용 후 즉시 삭제 또는 used=true

### 3. Rate Limiting (선택사항)
```typescript
// 비밀번호 찾기 요청 제한
// - 동일 IP: 5분에 3회
// - 동일 이메일: 1시간에 3회
```

---

## ✅ 확정된 내용

### 1. User 테이블
- ✅ 기본 구조 확인됨
- ✅ bcrypt 비밀번호 해싱 적용
- ✅ UserRole enum 정의
- ⚠️ PasswordResetToken 관계 추가 필요

### 2. 세션 관리
- ✅ NextAuth v5 + JWT 전략
- ✅ 세션 정보에 role, clinicId 포함
- ✅ Database Session 테이블 불필요

### 3. 구현 필요 기능
- ⚠️ PasswordResetToken 테이블 생성
- ⚠️ 비밀번호 찾기/재설정 페이지
- ⚠️ 최초 설정 페이지 (/setup)
- ⚠️ 이메일 발송 기능

---

---

## ✅ 6. QR 출퇴근 시스템

### 페이지: `/attendance/qr`, `/attendance/check/[token]`, `/attendance/history`

### 워크플로우

#### 1) QR 토큰 생성 플로우 (관리자)
```
관리자 → /attendance/qr 페이지 접근
        → QR 코드 자동 생성 (5분 유효)
        → QRToken 테이블에 저장
        → QR 코드 표시 (태블릿/PC)
        → 5분마다 자동 갱신
```

#### 2) 출퇴근 체크 플로우 (직원)
```
직원 → 스마트폰으로 QR 스캔
     → /attendance/check/[token] 페이지 이동
     → 토큰 유효성 검증 (5분 이내, 미사용)
     → 직원 선택 (드롭다운)
     → PIN 6자리 입력
     → 출근/퇴근 선택
     → 디바이스 정보 자동 수집 (fingerprint)
     → POST /api/attendance/check
     → 검증:
        - 토큰 유효성
        - PIN 일치 여부
        - 중복 체크 방지 (당일 출근 2회 방지)
        - 디바이스 등록 여부
     → AttendanceRecord 생성
     → QRToken.used = true
     → 성공 메시지 표시
```

#### 3) 디바이스 등록 플로우
```
최초 사용 시 → 디바이스 정보 수집
             → DeviceFingerprint 생성
             → Staff.registeredDevices에 추가 (JSON)
             → 다음부터는 등록된 디바이스로 체크
```

---

## 📋 테이블 설계 (출퇴근 관련)

### QRToken 모델 (⚠️ 새로 추가 필요)

```prisma
model QRToken {
  id          String   @id @default(cuid())
  clinicId    String
  clinic      Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  token       String   @unique      // UUID v4
  expiresAt   DateTime              // 생성 시간 + 5분
  used        Boolean  @default(false)  // 사용 여부
  usedAt      DateTime?             // 사용 시간
  usedBy      String?               // 사용한 직원 ID (Staff)

  createdAt   DateTime @default(now())

  @@index([clinicId])
  @@index([token])
  @@index([expiresAt])
  @@index([used])
}
```

### AttendanceRecord 모델 (⚠️ 새로 추가 필요)

```prisma
model AttendanceRecord {
  id                  String   @id @default(cuid())
  clinicId            String
  clinic              Clinic   @relation(fields: [clinicId], references: [id], onDelete: Cascade)

  staffId             String
  staff               Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)

  checkType           CheckType           // IN (출근) / OUT (퇴근)
  checkTime           DateTime            // 체크 시간
  date                DateTime   @db.Date // 체크 날짜 (검색용)

  // QR 토큰 정보
  tokenUsed           String?             // 사용한 QR 토큰

  // 디바이스 정보
  deviceFingerprint   String              // 디바이스 고유 ID
  userAgent           String?
  ipAddress           String?
  wifiSSID            String?             // WiFi 이름 (선택)

  // 위치 정보 (선택)
  gpsLatitude         Float?
  gpsLongitude        Float?

  // 사진 (선택)
  photoPath           String?

  // 이상 패턴
  isSuspicious        Boolean  @default(false)
  suspiciousReason    String?             // 의심 사유

  notes               String?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([clinicId])
  @@index([staffId])
  @@index([date])
  @@index([checkType])
  @@index([isSuspicious])
}

enum CheckType {
  IN      // 출근
  OUT     // 퇴근
}
```

### DeviceInfo 모델 (⚠️ 선택사항 - 고급 기능)

디바이스 관리를 더 상세하게 하려면 별도 테이블을 만들 수 있지만,
현재는 `Staff.registeredDevices` JSON 필드로 간단히 관리:

```typescript
// Staff.registeredDevices 구조 예시
{
  devices: [
    {
      fingerprint: "abc123...",
      nickname: "아이폰 14",
      userAgent: "Mozilla/5.0...",
      firstSeen: "2025-10-01T09:00:00Z",
      lastSeen: "2025-10-24T09:00:00Z",
      usageCount: 45,
      isBlocked: false
    }
  ]
}
```

---

## 🔍 디바이스 핑거프린팅

### 수집하는 정보

```typescript
// src/lib/device-fingerprint.ts

interface DeviceFingerprintData {
  // 브라우저 정보
  userAgent: string;
  platform: string;
  language: string;

  // 화면 정보
  screenWidth: number;
  screenHeight: number;
  screenColorDepth: number;

  // 시스템 정보
  timezone: string;
  timezoneOffset: number;
  cpuCores: number;

  // 터치 지원
  touchSupport: boolean;
  maxTouchPoints: number;
}

function collectDeviceInfo(): DeviceFingerprintData {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenColorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    cpuCores: navigator.hardwareConcurrency || 0,
    touchSupport: 'ontouchstart' in window,
    maxTouchPoints: navigator.maxTouchPoints || 0,
  };
}

// 핑거프린트 생성 (해시)
async function generateFingerprint(data: DeviceFingerprintData): Promise<string> {
  const str = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

---

## 🔍 보안 검증 로직

### 출퇴근 체크 시 검증 항목

```typescript
// src/lib/attendance/validation.ts

interface AttendanceCheckRequest {
  token: string;
  staffId: string;
  pin: string;
  checkType: 'IN' | 'OUT';
  deviceFingerprint: string;
}

async function validateAttendanceCheck(req: AttendanceCheckRequest) {
  // 1. QR 토큰 검증
  const qrToken = await prisma.qRToken.findUnique({
    where: { token: req.token }
  });

  if (!qrToken) {
    throw new Error('유효하지 않은 QR 코드입니다.');
  }

  if (qrToken.used) {
    throw new Error('이미 사용된 QR 코드입니다.');
  }

  if (new Date() > qrToken.expiresAt) {
    throw new Error('만료된 QR 코드입니다. 새로 스캔해주세요.');
  }

  // 2. 직원 정보 및 PIN 검증
  const staff = await prisma.staff.findUnique({
    where: { id: req.staffId }
  });

  if (!staff) {
    throw new Error('존재하지 않는 직원입니다.');
  }

  if (staff.pin !== req.pin) {
    throw new Error('PIN이 일치하지 않습니다.');
  }

  // 3. 디바이스 검증 (선택사항)
  const registeredDevices = staff.registeredDevices as any;
  const isRegistered = registeredDevices?.devices?.some(
    (d: any) => d.fingerprint === req.deviceFingerprint
  );

  // 신규 디바이스면 자동 등록 또는 관리자 승인 필요
  // (정책에 따라 결정)

  // 4. 중복 체크 방지
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingCheck = await prisma.attendanceRecord.findFirst({
    where: {
      staffId: req.staffId,
      checkType: req.checkType,
      date: today,
    }
  });

  if (existingCheck) {
    throw new Error(`오늘 이미 ${req.checkType === 'IN' ? '출근' : '퇴근'} 체크를 하셨습니다.`);
  }

  // 5. 시간대 검증 (선택사항)
  const hour = new Date().getHours();
  if (req.checkType === 'IN' && (hour < 6 || hour > 12)) {
    // 의심 패턴으로 기록하지만 체크는 허용
    return { isSuspicious: true, reason: '비정상 출근 시간' };
  }

  return { isSuspicious: false };
}
```

---

## 🔍 QR 출퇴근 API 엔드포인트

### 구현 필요 ⚠️

```typescript
// QR 토큰 생성 (자동 갱신)
GET /api/attendance/qr-token
// → 현재 유효한 토큰 반환 또는 새로 생성
// → expiresAt이 1분 이내면 새로 생성

// 토큰 검증
GET /api/attendance/check/[token]
// → 토큰 유효성만 검증
// → 직원 목록 반환

// 출퇴근 체크
POST /api/attendance/check
{
  token: string,
  staffId: string,
  pin: string,
  checkType: 'IN' | 'OUT',
  deviceInfo: DeviceFingerprintData
}
// → 모든 검증 수행
// → AttendanceRecord 생성
// → QRToken.used = true

// 출퇴근 기록 조회
GET /api/attendance/records?date=2025-10-24&staffId=xxx
// → 날짜별, 직원별 필터링

// 출퇴근 통계
GET /api/attendance/statistics?month=2025-10
// → 월별 통계
// → 지각/조퇴 횟수
// → 정상 출근율
```

---

## ✅ 확정된 내용

### 1. QR 토큰 시스템
- ⚠️ QRToken 테이블 추가 필요
- ✅ 5분 유효기간
- ✅ 1회만 사용 가능
- ✅ 자동 갱신 로직 필요

### 2. 출퇴근 기록
- ⚠️ AttendanceRecord 테이블 추가 필요
- ✅ 디바이스 핑거프린트 저장
- ✅ 중복 체크 방지
- ✅ 이상 패턴 감지 (선택)

### 3. 디바이스 관리
- ✅ Staff.registeredDevices (JSON) 사용
- ⚠️ 별도 DeviceInfo 테이블은 선택사항
- ✅ 자동 등록 또는 수동 승인 (정책 결정 필요)

### 4. 보안
- ✅ PIN 6자리 검증
- ✅ QR 토큰 만료 검증
- ✅ 중복 체크 방지
- ⚠️ GPS, WiFi, 사진은 선택사항

---

## 📊 전체 DB 설계 요약

### 추가/수정 필요한 테이블

| 테이블 | 상태 | 비고 |
|--------|------|------|
| **Staff** | 🔧 수정 필요 | categories, birthDate, pin 추가 |
| **RuleSettings** | 🔧 수정 필요 | weekBusinessDays, defaultWorkDays, staffCategories 추가 |
| **ApplicationLink** | ✅ 확인됨 | 기존 구조 유지 |
| **LeaveApplication** | ✅ 확인됨 | 기존 구조 유지 |
| **SlotLimit** | ❌ 삭제 예정 | 주별 계산으로 변경 |
| **WeekInfo** | ➕ 새로 추가 | 주별 슬롯 정보 |
| **DailySlot** | ➕ 새로 추가 | 날짜별 슬롯 정보 |
| **PasswordResetToken** | ➕ 새로 추가 | 비밀번호 재설정 |
| **QRToken** | ➕ 새로 추가 | QR 출퇴근 토큰 |
| **AttendanceRecord** | ➕ 새로 추가 | 출퇴근 기록 |

---

**작성자**: Claude Code
**상태**: 전체 DB 설계 완료 ✅ (Prisma 스키마 업데이트 대기)
