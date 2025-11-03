# Weekly 4-Day Work Limit Implementation

## Overview
This document describes the implementation of the weekly 4-day work limit as the highest priority constraint in the auto-assign schedule logic.

## Date
2025-11-02

## Objective
Add a strict weekly 4-day work limit that takes precedence over all other constraints (including fairness calculations) in the staff auto-assignment algorithm.

## Requirements

### Priority Order (Highest to Lowest)
1. **주4일 근무 원칙 (Weekly 4-day work limit)** - ERROR TOLERANCE: 0
2. **야간 형평성 (Night shift fairness)** - for days with night shift
3. **총 근무일 형평성 (Total workday fairness)**

### Key Rules
- **Week boundaries**: Sunday to Saturday
- **연차 (Annual leave) counts as a work day** for the weekly limit
- **오프 (OFF) does NOT count** as a work day
- Staff who have already worked/scheduled for 4 days in a week are **automatically filtered out** before any fairness calculations

## Implementation Details

### Modified File
`D:\작업\프로그램 만들기\ysbaro-Scheduler\src\app\api\schedule\auto-assign\route.ts`

### New Functions

#### 1. `getWeekKey(date: Date): string`
**Purpose**: Calculate which week a date belongs to (Sunday-based week)

**Returns**: Week key in format `"YYYY-Www"` (e.g., `"2024-W43"`)

**Algorithm**:
- Finds the Sunday of the week containing the given date
- Calculates week number based on the first Sunday of the year
- Week boundaries: Sunday (day 0) to Saturday (day 6)

#### 2. `calculateWeeklyWorkDays()`
**Purpose**: Calculate total work days for a staff member in a specific week

**Parameters**:
- `staffId`: Staff member ID
- `weekKey`: Week identifier (e.g., "2024-W43")
- `scheduleId`: Current schedule ID
- `confirmedLeaves`: List of confirmed leave applications
- `existingAssignments`: Map tracking assignments made in current cycle

**Returns**: Number of work days in the week (including 연차)

**Counts**:
1. ✅ Existing DB assignments with `shiftType != 'OFF'`
2. ✅ Confirmed 연차 (ANNUAL leave type) that aren't already in DB
3. ✅ Assignments made during current auto-assign cycle
4. ❌ OFF assignments (not counted)
5. ❌ 오프 leave type (not counted)

### Modified Logic Flow

#### Before (Old Flow)
```
For each date:
  1. Filter available staff (department, not on leave)
  2. Calculate fairness scores for all available staff
  3. Sort by fairness (day-type specific)
  4. Assign top N staff
```

#### After (New Flow)
```
For each date:
  1. Filter available staff (department, not on leave)
  2. Calculate week key for current date
  3. ⭐ NEW: Calculate weekly work days for each staff
  4. ⭐ NEW: Filter out staff with 4+ work days this week
  5. ⭐ NEW: If no staff available, log warning and skip date
  6. Calculate fairness scores for remaining staff
  7. Sort by fairness (day-type specific)
  8. Assign top N staff
  9. ⭐ NEW: Track assignment in dailyAssignments map
```

### Key Code Changes

#### 1. Added Weekly Work Count Interface
```typescript
interface WeeklyWorkCount {
  weekKey: string // Format: "YYYY-Www" (e.g., "2024-W43")
  count: number // Work days in this week (including 연차)
}
```

#### 2. Added Tracking Map
```typescript
// Track assignments made during this cycle
const dailyAssignments = new Map<string, Set<string>>()
```

#### 3. Added Weekly Limit Filter (Lines 533-586)
```typescript
// Calculate week key
const currentWeekKey = getWeekKey(currentDate)

// Calculate work days for each staff
const weeklyWorkCounts = await Promise.all(
  availableTreatmentStaff.map(async staff => {
    const workDays = await calculateWeeklyWorkDays(
      staff.id,
      currentWeekKey,
      schedule.id,
      confirmedLeaves,
      dailyAssignments
    )
    return { staffId: staff.id, staffName: staff.name, workDays }
  })
)

// Filter staff who already worked 4+ days
availableTreatmentStaff = availableTreatmentStaff.filter(s => {
  const workDays = (weeklyWorkCountMap.get(s.id) ?? 0) as number
  return workDays < 4
})

// If no staff available, skip this date
if (availableTreatmentStaff.length === 0) {
  warnings.push(`${dateKey}: 주4일 근무 제한으로 인해 배정 가능한 직원이 없습니다`)
  continue
}
```

#### 4. Updated Assignment Tracking (Lines 770-774)
```typescript
// Track assignments for weekly limit calculation
if (!dailyAssignments.has(dateKey)) {
  dailyAssignments.set(dateKey, new Set())
}
dailyAssignments.get(dateKey)!.add(staff.id)
```

## Testing Scenarios

### Scenario 1: Basic Weekly Limit
**Setup**:
- Staff A works Mon, Tue, Wed, Thu (4 days)
- Friday needs 3 staff members

**Expected**:
- Staff A is filtered out before fairness calculation
- Staff A does not appear in Friday assignment options

### Scenario 2: Annual Leave Counts
**Setup**:
- Staff B has 연차 on Monday
- Staff B works Tue, Wed, Thu (3 days + 1 연차 = 4 total)
- Friday needs staff

**Expected**:
- Staff B is filtered out (연차 counts as work day)
- Staff B does not appear in Friday assignment options

### Scenario 3: OFF Leave Does Not Count
**Setup**:
- Staff C has 오프 on Monday
- Staff C works Tue, Wed, Thu (3 days, 오프 not counted)
- Friday needs staff

**Expected**:
- Staff C has 3 work days this week
- Staff C is eligible for Friday assignment

### Scenario 4: Cross-Week Assignments
**Setup**:
- Week 1 (Sun-Sat): Staff D works Thu, Fri, Sat (3 days)
- Week 2 starts on Sunday

**Expected**:
- Staff D can work Sunday (new week, count resets to 0)

## Console Output

The implementation adds detailed logging:

```
📅 2024-10-21 배정 (NORMAL 유형):
   - 원장: A, B
   - 야간진료: 아니오
   - 주차: 2024-W43
   - 초기 가용 진료실 직원: 10명
   - 주4일 제한 도달 직원 (배정 제외): 김철수(4일), 이영희(4일)
   - 주4일 제한 적용 후 가용 직원: 8명
```

## Database Schema
No database schema changes required. The implementation uses existing tables:
- `StaffAssignment`: Tracks work assignments
- `LeaveApplication`: Tracks 연차/오프 applications

## Performance Considerations

### Potential Optimization Points
1. **Weekly work count calculation**: Currently queries DB for each staff member on each date
   - Could be optimized with batch query at start of month
   - Trade-off: Memory vs DB queries

2. **Week boundary calculation**: Computed for each date
   - Could be pre-computed and cached
   - Low impact since calculation is simple

### Current Performance
- Additional ~N DB queries per date (N = number of available staff)
- Acceptable for typical clinic sizes (5-15 staff members)

## Edge Cases Handled

1. ✅ **Month boundaries**: Week can span across months
2. ✅ **Year boundaries**: Week can span across years
3. ✅ **Partial weeks**: First/last week of month may not be complete
4. ✅ **No available staff**: Warning added, date skipped
5. ✅ **Flexible staff**: Filtered list respects weekly limit for flex assignments too

## Warnings Added

New warning type:
```
"${dateKey}: 주4일 근무 제한으로 인해 배정 가능한 직원이 없습니다"
```

This warning appears when all available staff have reached the 4-day limit for that week.

## Impact on Fairness System

The weekly 4-day limit is enforced **BEFORE** fairness calculations, meaning:
- Fairness scores are only calculated for eligible staff (< 4 days/week)
- Staff at 4-day limit are completely excluded from consideration
- This may create temporary fairness imbalances if many staff hit the limit
- Over multiple weeks, fairness should balance out as different staff hit limits

## Backward Compatibility

✅ **Fully backward compatible**
- No breaking changes to existing API
- No database migrations required
- Existing schedules unaffected
- Can be deployed without data migration

## Future Enhancements

Possible improvements:
1. Make the 4-day limit configurable (clinic setting)
2. Add override mechanism for emergency situations
3. Create weekly summary report showing who reached limits
4. Add predictive warnings when staff approaching limit

## Related Files

- `src/lib/services/fairness-calculator-v2.ts` - Fairness calculation (unchanged)
- `src/app/api/schedule/auto-assign/route.ts` - Main implementation (modified)

## Verification

To verify the implementation works correctly:

1. Create a test schedule for a month
2. Give Staff A three 연차 days early in a week
3. Run auto-assign
4. Check that Staff A is not assigned on 4th+ day of that week
5. Check console logs show Staff A filtered out due to weekly limit

## Conclusion

The weekly 4-day work limit has been successfully implemented as the highest priority constraint in the auto-assign logic. The implementation:
- ✅ Correctly counts 연차 as work days
- ✅ Excludes staff at 4-day limit before fairness calculations
- ✅ Uses Sunday-Saturday week boundaries
- ✅ Provides clear logging and warnings
- ✅ Maintains backward compatibility
- ✅ Handles edge cases appropriately
