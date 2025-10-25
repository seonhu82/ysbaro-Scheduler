/**
 * 주간 배치 시스템 유틸리티 함수들
 *
 * 이 파일은 weekly-assign-v2.ts의 핵심 알고리즘을 지원하는
 * 헬퍼 함수들을 포함합니다.
 */

import { prisma } from '@/lib/prisma'

/**
 * 형평성 유형별 우선순위 계산
 *
 * @param fairnessTypes - 형평성 유형 배열 (예: ['HOLIDAY', 'NIGHT_SHIFT'])
 * @returns 우선순위 점수 (높을수록 먼저 배치해야 함)
 *
 * 우선순위:
 * - HOLIDAY (공휴일): 4
 * - HOLIDAY_ADJACENT (공휴일 전후): 3
 * - HOLIDAY_ADJACENT_SUNDAY (공휴일 전후 일요일): 3
 * - WEEKEND (주말): 2
 * - NIGHT_SHIFT (야간근무): 1
 * - 없음: 0
 */
export function calculatePriority(fairnessTypes: string[]): number {
  if (fairnessTypes.includes('HOLIDAY')) return 4
  if (fairnessTypes.includes('HOLIDAY_ADJACENT')) return 3
  if (fairnessTypes.includes('HOLIDAY_ADJACENT_SUNDAY')) return 3
  if (fairnessTypes.includes('WEEKEND')) return 2
  if (fairnessTypes.includes('NIGHT_SHIFT')) return 1
  return 0
}

/**
 * 직원의 형평성 점수 가져오기
 *
 * @param staff - 직원 객체 (fairnessScores 포함)
 * @param fairnessTypes - 확인할 형평성 유형들
 * @returns 해당 유형의 누적 점수 (신규 직원은 0)
 */
export function getFairnessScore(
  staff: {
    fairnessScores: Array<{
      nightShiftCount: number
      weekendCount: number
      holidayCount: number
      holidayAdjacentCount: number
    }>
  },
  fairnessTypes: string[]
): number {
  const fairnessScore = staff.fairnessScores[0]

  // 신규 직원은 점수 0 → 최우선 배치
  if (!fairnessScore) {
    return 0
  }

  let score = 0

  // 가장 우선순위 높은 유형의 점수 반환
  if (fairnessTypes.includes('HOLIDAY')) {
    score = fairnessScore.holidayCount
  } else if (fairnessTypes.includes('HOLIDAY_ADJACENT') || fairnessTypes.includes('HOLIDAY_ADJACENT_SUNDAY')) {
    score = fairnessScore.holidayAdjacentCount
  } else if (fairnessTypes.includes('WEEKEND')) {
    score = fairnessScore.weekendCount
  } else if (fairnessTypes.includes('NIGHT_SHIFT')) {
    score = fairnessScore.nightShiftCount
  }

  return score
}

/**
 * 주간 배치 데이터를 DB에 저장
 *
 * @param weeklyAssignments - 직원별 배치된 날짜들 (staffId → Set<dateString>)
 * @param dailySlots - 날짜별 DailySlot 정보들
 * @param assignmentDetails - 날짜별 상세 배치 정보
 */
export async function saveWeeklyAssignments(
  weeklyAssignments: Map<string, Set<string>>,
  dailySlots: Map<string, { id: string; date: Date }>,
  assignmentDetails: Map<string, Array<{ staffId: string; category: string }>>
): Promise<void> {
  const assignmentsToCreate: Array<{
    dailySlotId: string
    staffId: string
  }> = []

  // 날짜별로 배치 정보 수집
  for (const [dateKey, assignments] of assignmentDetails.entries()) {
    const slot = dailySlots.get(dateKey)
    if (!slot) continue

    for (const assignment of assignments) {
      assignmentsToCreate.push({
        dailySlotId: slot.id,
        staffId: assignment.staffId
      })
    }
  }

  // 트랜잭션으로 일괄 저장
  await prisma.$transaction(async (tx) => {
    // 기존 배치 삭제 (해당 주의 모든 슬롯)
    const slotIds = Array.from(dailySlots.values()).map(s => s.id)
    await tx.dailyStaffAssignment.deleteMany({
      where: { dailySlotId: { in: slotIds } }
    })

    // 새 배치 생성
    if (assignmentsToCreate.length > 0) {
      await tx.dailyStaffAssignment.createMany({
        data: assignmentsToCreate
      })
    }
  })
}

/**
 * 미해결 이슈 저장
 *
 * @param weekInfoId - 주차 정보 ID
 * @param issues - 미해결 이슈 목록
 */
export async function saveUnresolvedIssues(
  weekInfoId: string,
  issues: Array<{
    issueType: string
    severity: string
    staffId?: string
    category?: string
    date?: Date
    message: string
    suggestion?: string
    status: string
  }>
): Promise<void> {
  if (issues.length === 0) return

  await prisma.$transaction(async (tx) => {
    // 기존 이슈 삭제 (해당 주차의)
    await tx.unresolvedIssue.deleteMany({
      where: { weekInfoId }
    })

    // 새 이슈 생성
    await tx.unresolvedIssue.createMany({
      data: issues.map(issue => ({
        weekInfoId,
        ...issue
      }))
    })
  })
}

/**
 * 이전 주차의 미해결 이슈 로드
 *
 * @param previousWeekInfoId - 이전 주차 정보 ID
 * @returns 미해결 이슈 목록
 */
export async function loadUnresolvedIssues(
  previousWeekInfoId: string | null
): Promise<Array<{
  id: string
  issueType: string
  severity: string
  staffId: string | null
  category: string | null
  date: Date | null
  message: string
  suggestion: string | null
  status: string
}>> {
  if (!previousWeekInfoId) return []

  return await prisma.unresolvedIssue.findMany({
    where: {
      weekInfoId: previousWeekInfoId,
      status: 'PENDING_NEXT_WEEK'
    },
    orderBy: { createdAt: 'asc' }
  })
}

/**
 * Flexible Staff로 부족 인원 재시도
 *
 * @param clinicId - 병원 ID
 * @param category - 부족한 카테고리
 * @param date - 날짜
 * @param required - 필요 인원 수
 * @param excludeStaffIds - 제외할 직원 ID들
 * @returns 배치 성공 여부 및 배치된 직원들
 */
export async function tryFlexibleStaffAssignment(
  clinicId: string,
  category: string,
  date: Date,
  required: number,
  excludeStaffIds: Set<string>,
  weeklyAssignments: Map<string, Set<string>>,
  staffWorkDayCount: Map<string, { required: number; current: number; leave: number }>
): Promise<{
  success: boolean
  assignedStaff?: Array<{ id: string; name: string }>
  reason?: string
}> {
  const dateKey = date.toISOString().split('T')[0]

  // Flexible Staff 조회
  const flexibleStaff = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true,
      flexibleForCategories: { has: category },
      id: { notIn: Array.from(excludeStaffIds) }
    },
    include: {
      fairnessScores: {
        take: 1,
        orderBy: { year: 'desc' }
      }
    },
    orderBy: { flexibilityPriority: 'desc' }
  })

  // 가용한 flexible staff 필터링
  const availableFlexible = flexibleStaff.filter(staff => {
    // 이미 이 날짜에 배치됨
    const assignedDates = weeklyAssignments.get(staff.id)
    if (assignedDates?.has(dateKey)) return false

    // 주간 근무일수 초과
    const workStatus = staffWorkDayCount.get(staff.id)
    if (workStatus) {
      const totalDays = workStatus.current + workStatus.leave
      if (totalDays >= workStatus.required) return false
    }

    return true
  })

  if (availableFlexible.length >= required) {
    const assigned = availableFlexible.slice(0, required)

    // 배치 기록 업데이트
    assigned.forEach(staff => {
      const dates = weeklyAssignments.get(staff.id) || new Set()
      dates.add(dateKey)
      weeklyAssignments.set(staff.id, dates)

      const workStatus = staffWorkDayCount.get(staff.id)
      if (workStatus) {
        workStatus.current++
      }
    })

    return {
      success: true,
      assignedStaff: assigned.map(s => ({ id: s.id, name: s.name }))
    }
  }

  return {
    success: false,
    reason: `Flexible staff 부족: ${availableFlexible.length}명 가능, ${required}명 필요`
  }
}

/**
 * 근무일수 부족 직원을 남은 날짜에 배치 시도
 *
 * @param staffId - 직원 ID
 * @param remainingDays - 남은 배치 가능 날짜들
 * @param weeklyAssignments - 주간 배치 현황
 * @param assignmentDetails - 날짜별 상세 배치
 * @param staffWorkDayCount - 직원별 근무일수 현황
 * @returns 배치 성공 여부 및 배치된 날짜들
 */
export async function tryFillStaffShortage(
  staffId: string,
  remainingDays: Array<{
    dateKey: string
    date: Date
    categoryRequirements: Record<string, number>
    currentAssignments: number
    departmentRequiredStaff?: Record<string, number> // 부서별 필요 인원
    departmentName?: string // 직원의 부서
  }>,
  weeklyAssignments: Map<string, Set<string>>,
  assignmentDetails: Map<string, Array<{ staffId: string; category: string }>>,
  staffWorkDayCount: Map<string, { required: number; current: number; leave: number }>,
  staffCategory: string
): Promise<{
  success: boolean
  assignedDates?: string[]
  reason?: string
}> {
  const workStatus = staffWorkDayCount.get(staffId)
  if (!workStatus) {
    return { success: false, reason: '직원 근무 정보 없음' }
  }

  const shortage = workStatus.required - (workStatus.current + workStatus.leave)
  if (shortage <= 0) {
    return { success: true, assignedDates: [] }
  }

  const assignedDates: string[] = []
  const assignedDateSet = weeklyAssignments.get(staffId) || new Set()

  // 남은 날짜 중에서 배치 가능한 날짜 찾기
  for (const day of remainingDays) {
    if (assignedDates.length >= shortage) break

    // 이미 배치됨
    if (assignedDateSet.has(day.dateKey)) continue

    // 부서별 배치 로직 (새 기능)
    const hasDepartmentReqs = day.departmentRequiredStaff && Object.keys(day.departmentRequiredStaff).length > 0
    const staffDept = day.departmentName

    if (hasDepartmentReqs && staffDept && day.departmentRequiredStaff) {
      // 부서별 배치 검증
      const deptRequired = day.departmentRequiredStaff[staffDept] || 0
      if (deptRequired === 0) continue // 이 부서는 자동배치 사용 안 함

      const assignments = assignmentDetails.get(day.dateKey) || []
      const deptAssignments = assignments.filter(a => {
        // Note: 여기서는 staffId로 부서를 판단할 수 없으므로 근사값 사용
        // 실제로는 allActiveStaff를 전달받아야 하지만, 레거시 호환성을 위해 간단히 처리
        return true // TODO: 추후 개선 필요
      })

      // 부서 내 카테고리별 필요 인원 계산
      const totalRequired = Object.values(day.categoryRequirements).reduce((sum, v) => sum + v, 0)
      const deptCategoryRequired = Math.round((day.categoryRequirements[staffCategory] || 0) * (deptRequired / totalRequired))

      const categoryAssigned = assignments.filter(a => a.category === staffCategory).length

      if (categoryAssigned < deptCategoryRequired) {
        // 배치 가능
        assignedDateSet.add(day.dateKey)
        assignedDates.push(day.dateKey)

        assignments.push({
          staffId,
          category: staffCategory
        })
        assignmentDetails.set(day.dateKey, assignments)

        workStatus.current++
      }
    } else {
      // 레거시: 전체 카테고리별 배치
      const categoryRequired = day.categoryRequirements[staffCategory] || 0
      const assignments = assignmentDetails.get(day.dateKey) || []
      const categoryAssigned = assignments.filter(a => a.category === staffCategory).length

      if (categoryAssigned < categoryRequired) {
        // 배치 가능
        assignedDateSet.add(day.dateKey)
        assignedDates.push(day.dateKey)

        assignments.push({
          staffId,
          category: staffCategory
        })
        assignmentDetails.set(day.dateKey, assignments)

        workStatus.current++
      }
    }
  }

  weeklyAssignments.set(staffId, assignedDateSet)

  if (assignedDates.length >= shortage) {
    return { success: true, assignedDates }
  }

  return {
    success: false,
    assignedDates,
    reason: `${shortage}일 필요, ${assignedDates.length}일만 배치 가능`
  }
}

/**
 * 이슈가 정당한지 확인 (조율 불가능한 이슈인지 판단)
 *
 * @param issue - 검증 이슈
 * @param staffWorkDayCount - 직원별 근무일수 현황
 * @param confirmedLeaves - 확정된 연차/오프 목록
 * @returns 이슈가 정당한지 여부 및 이유
 */
export async function checkIfJustified(
  issue: {
    type: string
    severity: string
    staffId?: string
    category?: string
    date?: Date
    message: string
  },
  staffWorkDayCount: Map<string, { required: number; current: number; leave: number }>,
  confirmedLeaves: Array<{ staffId: string; date: Date }>
): Promise<{ valid: boolean; reason: string }> {
  // 인원 부족 이슈
  if (issue.type === 'SHORTAGE') {
    // 모든 가용 인력 확인
    const totalStaff = staffWorkDayCount.size
    const fullyAssigned = Array.from(staffWorkDayCount.values()).filter(
      status => status.current + status.leave >= status.required
    ).length

    if (fullyAssigned === totalStaff) {
      return {
        valid: true,
        reason: '모든 직원이 주간 근무일수를 채웠으나 슬롯 부족'
      }
    }

    return {
      valid: false,
      reason: '아직 배치 가능한 직원 존재'
    }
  }

  // 근무일수 초과 이슈
  if (issue.type === 'EXCESS' && issue.staffId) {
    const workStatus = staffWorkDayCount.get(issue.staffId)
    if (workStatus && workStatus.current > workStatus.required) {
      return {
        valid: true,
        reason: `필요 ${workStatus.required}일, 배치 ${workStatus.current}일`
      }
    }
  }

  // 근무일수 부족 이슈
  if (issue.type === 'STAFF_SHORTAGE' && issue.staffId) {
    const workStatus = staffWorkDayCount.get(issue.staffId)
    if (workStatus) {
      const total = workStatus.current + workStatus.leave
      if (total < workStatus.required) {
        // 연차로 인한 부족인지 확인
        if (workStatus.leave > 0) {
          return {
            valid: true,
            reason: `연차 ${workStatus.leave}일 포함, 배치 가능 날짜 부족`
          }
        }

        return {
          valid: false,
          reason: '배치 가능 날짜 재확인 필요'
        }
      }
    }
  }

  // 형평성 이슈
  if (issue.type === 'UNFAIR') {
    return {
      valid: true,
      reason: '형평성 조정은 차주/익월 반영'
    }
  }

  return {
    valid: false,
    reason: '추가 조율 시도 가능'
  }
}

/**
 * 날짜 문자열 키 생성
 */
export function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * 주차 상태 업데이트
 */
export async function updateWeekStatus(
  weekInfoId: string,
  status: 'DRAFT' | 'ASSIGNING' | 'COMPLETED' | 'APPROVED',
  approvedBy?: string
): Promise<void> {
  const updateData: any = { status }

  if (status === 'COMPLETED') {
    updateData.completedAt = new Date()
  } else if (status === 'APPROVED' && approvedBy) {
    updateData.approvedAt = new Date()
    updateData.approvedBy = approvedBy
  }

  await prisma.weekInfo.update({
    where: { id: weekInfoId },
    data: updateData
  })
}
