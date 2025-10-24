# TODO: 완전한 구현을 위한 작업 목록

**작성일**: 2025-10-25
**상태**: 확인된 사실만 기반으로 작성
**목적**: 3대 기능(구분별 슬롯 관리, 유연 배치, 공휴일 형평성)의 실제 통합

---

## ⚠️ 현재 상태 요약

### ✅ 완료된 것 (확인됨)
1. **데이터베이스 스키마**: 모든 새 필드와 테이블이 추가됨
2. **초기 설정 페이지**: 모든 새 필드 입력 UI 구현됨
3. **초기 설정 API**: 모든 새 데이터를 DB에 저장함 (src/app/api/setup/initial/route.ts)
4. **서비스 파일 생성**: category-slot-service.ts, yearly-fairness-service.ts 확장

### ❌ 완료되지 않은 것 (확인됨)
1. **연차/오프 신청 API**: 완전히 삭제됨 (src/app/api/leave-apply/ 디렉토리 없음)
2. **자동 배치 알고리즘**: 빈 파일 (TODO만 있음)
3. **서비스 통합**: 생성된 서비스들이 어디에도 import/호출되지 않음
4. **ON_HOLD 워크플로우**: 구현되지 않음

---

## 🔴 CRITICAL: 삭제된 API 복구 필요

### 작업 1: Leave Application API 재생성
**우선순위**: 🔴 CRITICAL
**파일**: `src/app/api/leave-apply/[token]/submit/route.ts` (삭제됨, 재생성 필요)

**현재 문제**:
- Leave apply page(src/app/(public)/leave-apply/[token]/page.tsx:96)에서 `/api/leave-apply/${token}/submit` 호출
- 해당 API 엔드포인트가 완전히 삭제됨
- 연차/오프 신청 기능이 작동하지 않음

**필요한 작업**:
```typescript
// 파일: src/app/api/leave-apply/[token]/submit/route.ts (NEW)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCategoryAvailability } from '@/lib/services/category-slot-service'
import { fairnessValidationService } from '@/lib/services/fairness-validation-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { date, type } = await request.json()

    // 1. Token으로 link 및 staff 조회
    const link = await prisma.schedulingLink.findUnique({
      where: { token: params.token },
      include: { staff: true, period: true }
    })

    if (!link) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    const staffId = link.staffId
    const clinicId = link.staff.clinicId
    const applicationDate = new Date(date)

    // 2. DailySlot 조회 (requiredStaff, hasNightShift 등)
    const dailySlot = await prisma.dailySlot.findFirst({
      where: {
        date: applicationDate,
        week: { clinicId }
      },
      include: {
        combination: true,
        week: true
      }
    })

    if (!dailySlot) {
      return NextResponse.json({ error: 'No schedule for this date' }, { status: 400 })
    }

    const requiredStaff = dailySlot.requiredStaff
    const hasNightShift = dailySlot.combination?.hasNightShift || false

    // 3. 형평성 검증 (야간/주말만)
    const isHoliday = false // TODO: 실제 공휴일 조회
    const fairnessCheck = await fairnessValidationService.validateOffApplication(
      clinicId,
      staffId,
      applicationDate,
      hasNightShift,
      isHoliday
    )

    if (!fairnessCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: fairnessCheck.message,
        reason: fairnessCheck.reason
      }, { status: 400 })
    }

    // 4. 구분별 슬롯 확인
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    })

    const categoryCheck = await checkCategoryAvailability(
      clinicId,
      applicationDate,
      requiredStaff,
      staff!.categoryName
    )

    // 5. 신청 생성 (PENDING 또는 ON_HOLD)
    let status: 'PENDING' | 'ON_HOLD' = 'PENDING'
    let holdReason: string | null = null

    if (categoryCheck.shouldHold) {
      status = 'ON_HOLD'
      holdReason = categoryCheck.message
    }

    const application = await prisma.leaveApplication.create({
      data: {
        staffId,
        date: applicationDate,
        type,
        status,
        holdReason,
        linkId: link.id
      }
    })

    return NextResponse.json({
      success: true,
      application,
      status,
      message: status === 'ON_HOLD' ? holdReason : '신청이 완료되었습니다.'
    })

  } catch (error) {
    console.error('Leave application error:', error)
    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 500 }
    )
  }
}
```

**통합 포인트**:
- Line 16: `checkCategoryAvailability()` 호출 (category-slot-service.ts)
- Line 17: `fairnessValidationService.validateOffApplication()` 호출
- Line 57: ON_HOLD status 생성

---

### 작업 2: 추가 Leave Application APIs 재생성

#### 2.1 내 신청 조회 API
**파일**: `src/app/api/leave-apply/[token]/my-application/route.ts` (삭제됨)

```typescript
// GET: 내 신청 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // Token으로 staff 조회
  // LeaveApplication 조회 (staffId, periodId 기준)
  // 반환: applications[]
}
```

#### 2.2 신청 상태 조회 API
**파일**: `src/app/api/leave-apply/[token]/status/route.ts` (삭제됨)

```typescript
// GET: 날짜별 슬롯 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // 구분별 슬롯 현황 조회
  // calculateCategorySlots() 호출
  // 반환: { date, categorySlots, available, total }[]
}
```

---

## 🟠 HIGH PRIORITY: Auto-Assign 알고리즘 구현

### 작업 3: Daily Auto-Assign 구현
**우선순위**: 🟠 HIGH
**파일**: `src/lib/algorithms/auto-assign.ts`

**현재 상태**:
```typescript
// 현재: 빈 함수
export async function autoAssignSingleSlot(slotId: string) {
  return { success: true, assignments: [], errors: [] }
}
```

**필요한 구현**:
```typescript
import { prisma } from '@/lib/prisma'
import { getFlexibleStaff, calculateCategorySlots } from '@/lib/services/category-slot-service'
import { fairnessValidationService } from '@/lib/services/fairness-validation-service'

export async function autoAssignSingleSlot(slotId: string) {
  // 1. DailySlot 조회
  const slot = await prisma.dailySlot.findUnique({
    where: { id: slotId },
    include: {
      week: { include: { clinic: true } },
      combination: true,
      assignments: { include: { staff: true } }
    }
  })

  if (!slot) {
    return { success: false, errors: ['Slot not found'] }
  }

  const clinicId = slot.week.clinicId
  const requiredStaff = slot.requiredStaff
  const date = slot.date

  // 2. CategoryRatioSettings 조회
  const ratioSettings = await prisma.categoryRatioSettings.findUnique({
    where: { clinicId }
  })

  if (!ratioSettings) {
    return { success: false, errors: ['Category ratio settings not found'] }
  }

  const ratios = ratioSettings.ratios as { [key: string]: number }

  // 3. 구분별 필요 인원 계산
  const categoryRequirements: { [category: string]: number } = {}
  Object.entries(ratios).forEach(([category, ratio]) => {
    categoryRequirements[category] = Math.round(requiredStaff * (ratio / 100))
  })

  // 4. 각 구분별로 직원 배치
  const assignments: any[] = []
  const errors: string[] = []

  for (const [category, required] of Object.entries(categoryRequirements)) {
    // 4.1 해당 구분 직원 조회 (오프 신청 안한 사람)
    const availableStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        categoryName: category,
        isActive: true,
        leaveApplications: {
          none: {
            date,
            status: { in: ['PENDING', 'CONFIRMED'] }
          }
        }
      }
    })

    // 4.2 형평성 기반 정렬
    // TODO: 형평성 점수 계산 및 정렬

    // 4.3 배치
    const assigned = availableStaff.slice(0, required)
    assignments.push(...assigned.map(s => ({ staffId: s.id, slotId })))

    // 4.4 부족하면 flexible staff 활용
    if (assigned.length < required) {
      const shortfall = required - assigned.length
      const assignedIds = assigned.map(s => s.id)

      const flexibleStaff = await getFlexibleStaff(
        clinicId,
        category,
        assignedIds
      )

      const flexAssigned = flexibleStaff.slice(0, shortfall)
      assignments.push(...flexAssigned.map(s => ({ staffId: s.id, slotId })))

      if (flexAssigned.length < shortfall) {
        errors.push(`${category}: ${shortfall - flexAssigned.length}명 부족`)
      }
    }
  }

  // 5. DB에 저장
  for (const assignment of assignments) {
    await prisma.staffAssignment.create({
      data: assignment
    })
  }

  return { success: errors.length === 0, assignments, errors }
}
```

**통합 포인트**:
- Line 2: `getFlexibleStaff()` import 및 호출
- Line 3: `fairnessValidationService` import (형평성 정렬용)
- Line 23: CategoryRatioSettings 사용
- Line 67: Flexible staff 활용

---

### 작업 4: Weekly Auto-Assign 구현
**우선순위**: 🟠 HIGH
**파일**: `src/lib/algorithms/weekly-assign.ts`

**현재 상태**:
```typescript
export async function createWeeklySchedule(clinicId: string, startDate: Date) {
  return { success: true, weekId: '' }
}
```

**필요한 구현**:
```typescript
export async function createWeeklySchedule(clinicId: string, startDate: Date) {
  // 1. WeekSchedule 생성
  const week = await prisma.weekSchedule.create({
    data: {
      clinicId,
      startDate,
      endDate: addDays(startDate, 6)
    }
  })

  // 2. 7일간 DailySlot 생성
  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i)
    const dayOfWeek = getDayOfWeek(date)

    // 해당 요일의 조합 조회
    const combination = await prisma.doctorCombination.findFirst({
      where: { clinicId, dayOfWeek }
    })

    if (!combination) continue

    // DailySlot 생성
    const slot = await prisma.dailySlot.create({
      data: {
        weekId: week.id,
        date,
        requiredStaff: combination.requiredStaff,
        dayType: 'WEEKDAY', // TODO: 공휴일 판단
        combinationId: combination.id
      }
    })

    // 각 슬롯 자동 배치
    await autoAssignSingleSlot(slot.id)
  }

  return { success: true, weekId: week.id }
}
```

**통합 포인트**:
- Line 35: `autoAssignSingleSlot()` 호출 (작업 3에서 구현)

---

### 작업 5: API Route 연결
**우선순위**: 🟠 HIGH

#### 5.1 Daily Auto-Assign API
**파일**: `src/app/api/auto-assign/daily/route.ts`

**현재 코드**:
```typescript
export async function POST(request: NextRequest) {
  try {
    // TODO: 일별 배치 - POST 구현
    return NextResponse.json({ success: true })
  } catch (error) {
```

**수정 필요**:
```typescript
import { autoAssignSingleSlot } from '@/lib/algorithms/auto-assign'

export async function POST(request: NextRequest) {
  try {
    const { slotId } = await request.json()

    const result = await autoAssignSingleSlot(slotId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Auto-assign error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to auto-assign' },
      { status: 500 }
    )
  }
}
```

#### 5.2 Weekly Auto-Assign API
**파일**: `src/app/api/auto-assign/weekly/route.ts`

**현재**: 빈 파일 (TODO만 있음)

**구현 필요**:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createWeeklySchedule } from '@/lib/algorithms/weekly-assign'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { startDate } = await request.json()

    const result = await createWeeklySchedule(
      session.user.clinicId,
      new Date(startDate)
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Weekly auto-assign error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create weekly schedule' },
      { status: 500 }
    )
  }
}
```

---

## 🟡 MEDIUM PRIORITY: 공휴일 형평성 통합

### 작업 6: DayType 분류 로직 구현
**우선순위**: 🟡 MEDIUM
**위치**: Weekly schedule 생성 시 또는 Daily slot 생성 시

**필요한 함수**:
```typescript
// 파일: src/lib/utils/day-type-classifier.ts (NEW)
import { prisma } from '@/lib/prisma'

export async function classifyDayType(
  clinicId: string,
  date: Date
): Promise<('WEEKDAY' | 'SATURDAY' | 'SUNDAY' | 'HOLIDAY' | 'HOLIDAY_ADJACENT' | 'HOLIDAY_ADJACENT_SUNDAY')[]> {
  const types: any[] = []
  const dayOfWeek = date.getDay()

  // 기본 분류
  if (dayOfWeek === 0) types.push('SUNDAY')
  else if (dayOfWeek === 6) types.push('SATURDAY')
  else types.push('WEEKDAY')

  // 공휴일 체크
  const holiday = await prisma.holiday.findFirst({
    where: {
      clinicId,
      date: {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999))
      }
    }
  })

  if (holiday && dayOfWeek !== 0) {
    types.push('HOLIDAY')
  }

  // 공휴일 전후일 체크
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)

  const tomorrow = new Date(date)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const adjacentHoliday = await prisma.holiday.findFirst({
    where: {
      clinicId,
      OR: [
        { date: yesterday },
        { date: tomorrow }
      ]
    }
  })

  if (adjacentHoliday) {
    if (dayOfWeek === 0) {
      types.push('HOLIDAY_ADJACENT_SUNDAY')
    } else {
      types.push('HOLIDAY_ADJACENT')
    }
  }

  return types
}
```

**통합 위치**:
- `src/lib/algorithms/weekly-assign.ts:31` - DailySlot 생성 시 dayType 설정
- `src/app/api/leave-apply/[token]/submit/route.ts:44` - 형평성 검증 시 사용

---

### 작업 7: 공휴일 형평성 실제 적용
**우선순위**: 🟡 MEDIUM
**파일**: `src/lib/algorithms/auto-assign.ts`

**현재**: 형평성 점수 계산 없음 (TODO 주석만 있음)

**필요한 구현** (작업 3의 Line 61 "// TODO: 형평성 점수 계산 및 정렬" 부분):
```typescript
// 4.2 형평성 기반 정렬
const year = date.getFullYear()
const month = date.getMonth() + 1

// 각 직원의 형평성 점수 계산
const staffWithScores = await Promise.all(
  availableStaff.map(async (staff) => {
    // FairnessScore 조회
    const fairnessScore = await prisma.fairnessScore.findFirst({
      where: { staffId: staff.id, year, month }
    })

    // 날짜 유형에 따라 해당 형평성 점수 사용
    const dayTypes = await classifyDayType(clinicId, date)

    let score = 0
    if (dayTypes.includes('HOLIDAY')) {
      score = fairnessScore?.holidayWorkCount || 0
    } else if (dayTypes.includes('HOLIDAY_ADJACENT')) {
      score = fairnessScore?.holidayAdjacentCount || 0
    } else if (dayTypes.includes('SATURDAY') || dayTypes.includes('SUNDAY')) {
      score = fairnessScore?.weekendCount || 0
    } else if (slot.combination?.hasNightShift) {
      score = fairnessScore?.nightShiftCount || 0
    }

    return { staff, score }
  })
)

// 점수가 낮은 순으로 정렬 (형평성을 위해)
staffWithScores.sort((a, b) => a.score - b.score)
const sortedStaff = staffWithScores.map(s => s.staff)

// 정렬된 순서로 배치
const assigned = sortedStaff.slice(0, required)
```

**통합 포인트**:
- Line 7: `classifyDayType()` 호출 (작업 6)
- Line 12-17: 공휴일/공휴일 전후 형평성 점수 사용
- Line 28: yearly-fairness-service의 점수 데이터 활용

---

## 🟢 LOW PRIORITY: ON_HOLD 워크플로우

### 작업 8: ON_HOLD 신청 승인/반려 API
**우선순위**: 🟢 LOW
**파일**: `src/app/api/leave-management/on-hold/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findApprovableOnHoldApplications } from '@/lib/services/category-slot-service'

// GET: ON_HOLD 신청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const applications = await prisma.leaveApplication.findMany({
      where: {
        staff: { clinicId: session.user.clinicId },
        status: 'ON_HOLD'
      },
      include: {
        staff: true
      },
      orderBy: { date: 'asc' }
    })

    return NextResponse.json({ applications })
  } catch (error) {
    console.error('Get ON_HOLD error:', error)
    return NextResponse.json(
      { error: 'Failed to get ON_HOLD applications' },
      { status: 500 }
    )
  }
}

// POST: ON_HOLD 신청 승인/반려
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { applicationId, action } = await request.json() // action: 'approve' | 'reject'

    const application = await prisma.leaveApplication.findUnique({
      where: { id: applicationId },
      include: { staff: true }
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (application.status !== 'ON_HOLD') {
      return NextResponse.json({ error: 'Not ON_HOLD status' }, { status: 400 })
    }

    if (action === 'approve') {
      await prisma.leaveApplication.update({
        where: { id: applicationId },
        data: {
          status: 'CONFIRMED',
          holdReason: null
        }
      })
    } else if (action === 'reject') {
      await prisma.leaveApplication.update({
        where: { id: applicationId },
        data: {
          status: 'REJECTED'
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ON_HOLD action error:', error)
    return NextResponse.json(
      { error: 'Failed to process ON_HOLD application' },
      { status: 500 }
    )
  }
}
```

---

### 작업 9: 자동 승인 로직
**우선순위**: 🟢 LOW
**위치**: 연차/오프가 취소되었을 때 자동으로 ON_HOLD를 CONFIRMED로 전환

**필요한 함수**:
```typescript
// 파일: src/lib/services/on-hold-auto-approve.ts (NEW)
import { prisma } from '@/lib/prisma'
import { findApprovableOnHoldApplications } from './category-slot-service'

export async function autoApproveOnHold(
  clinicId: string,
  date: Date,
  cancelledStaffCategory: string
) {
  // 1. 취소로 인해 생긴 여유 슬롯 1개
  const availableCount = 1

  // 2. 해당 날짜/구분의 승인 가능한 ON_HOLD 신청 찾기
  const approvableIds = await findApprovableOnHoldApplications(
    clinicId,
    date,
    availableCount
  )

  // 3. 승인
  for (const id of approvableIds) {
    await prisma.leaveApplication.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        holdReason: null
      }
    })
  }

  return { approvedCount: approvableIds.length }
}
```

**호출 위치**:
- 연차/오프 취소 API (삭제되어 재생성 필요)
- 연차/오프 반려 API

---

## 📋 체크리스트

### Phase 1: 기본 동작 복구
- [ ] 작업 1: Leave application submit API 재생성
- [ ] 작업 2.1: My application API 재생성
- [ ] 작업 2.2: Status API 재생성
- [ ] **테스트**: 연차/오프 신청이 성공하는지 확인
- [ ] **테스트**: ON_HOLD 상태가 정상적으로 생성되는지 확인

### Phase 2: 자동 배치 구현
- [ ] 작업 3: autoAssignSingleSlot() 구현
- [ ] 작업 4: createWeeklySchedule() 구현
- [ ] 작업 5.1: Daily auto-assign API 연결
- [ ] 작업 5.2: Weekly auto-assign API 연결
- [ ] **테스트**: 주간 스케줄 생성이 구분별 비율대로 배치되는지 확인
- [ ] **테스트**: Flexible staff가 부족한 구분에 배치되는지 확인

### Phase 3: 공휴일 형평성
- [ ] 작업 6: classifyDayType() 함수 구현
- [ ] 작업 7: 형평성 기반 정렬 로직 통합
- [ ] **테스트**: 공휴일/공휴일 전후 형평성이 계산되는지 확인
- [ ] **테스트**: 형평성 점수가 낮은 직원부터 배치되는지 확인

### Phase 4: ON_HOLD 워크플로우
- [ ] 작업 8: ON_HOLD API 구현
- [ ] 작업 9: 자동 승인 로직 구현
- [ ] **테스트**: ON_HOLD 신청 승인/반려가 작동하는지 확인
- [ ] **테스트**: 취소 시 자동 승인이 작동하는지 확인

---

## 🔍 검증 방법

### 1. 구분별 슬롯 관리 검증
```sql
-- 특정 날짜의 구분별 배치 현황 확인
SELECT
  s.categoryName,
  COUNT(*) as assigned_count,
  ds.requiredStaff
FROM StaffAssignment sa
JOIN Staff s ON sa.staffId = s.id
JOIN DailySlot ds ON sa.slotId = ds.id
WHERE ds.date = '2025-11-01'
GROUP BY s.categoryName, ds.requiredStaff

-- CategoryRatioSettings 확인
SELECT * FROM CategoryRatioSettings;
```

### 2. Flexible Staff 활용 검증
```sql
-- Flexible staff 배치 확인
SELECT
  s.name,
  s.categoryName,
  s.flexibleForCategories,
  s.flexibilityPriority,
  ds.date
FROM StaffAssignment sa
JOIN Staff s ON sa.staffId = s.id
JOIN DailySlot ds ON sa.slotId = ds.id
WHERE s.flexibleForCategories != '{}' -- PostgreSQL array not empty
ORDER BY ds.date, s.flexibilityPriority
```

### 3. 공휴일 형평성 검증
```sql
-- 공휴일/공휴일 전후 근무 현황
SELECT
  s.name,
  fs.holidayWorkCount,
  fs.holidayAdjacentCount,
  fs.nightShiftCount,
  fs.weekendCount
FROM FairnessScore fs
JOIN Staff s ON fs.staffId = s.id
WHERE fs.year = 2025 AND fs.month = 11
ORDER BY fs.holidayWorkCount DESC
```

### 4. ON_HOLD 워크플로우 검증
```sql
-- ON_HOLD 신청 현황
SELECT
  la.date,
  s.name,
  s.categoryName,
  la.status,
  la.holdReason
FROM LeaveApplication la
JOIN Staff s ON la.staffId = s.id
WHERE la.status = 'ON_HOLD'
ORDER BY la.date
```

---

## 📝 참고 사항

### 서비스 파일 위치
- **Category slot service**: `src/lib/services/category-slot-service.ts` (✅ 생성됨, ❌ 미사용)
- **Fairness validation**: `src/lib/services/fairness-validation-service.ts` (✅ 생성됨, ❌ 미사용)
- **Yearly fairness**: `src/lib/services/yearly-fairness-service.ts` (✅ 확장됨, ❌ 미사용)

### 알고리즘 파일 위치
- **Auto assign**: `src/lib/algorithms/auto-assign.ts` (⚠️ TODO만 있음)
- **Weekly assign**: `src/lib/algorithms/weekly-assign.ts` (⚠️ TODO만 있음)

### API 라우트 위치
- **Setup (완료)**: `src/app/api/setup/initial/route.ts` (✅ 모든 새 필드 저장)
- **Leave apply (삭제됨)**: `src/app/api/leave-apply/[token]/submit/route.ts` (❌ 재생성 필요)
- **Auto assign (미완)**: `src/app/api/auto-assign/*/route.ts` (⚠️ TODO만 있음)

---

**마지막 업데이트**: 2025-10-25
**작성자**: Claude Code
**확인 방법**: 실제 파일 읽기, grep, ls 명령으로 확인한 사실만 기록
