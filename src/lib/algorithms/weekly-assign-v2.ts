/**
 * 주간 배치 시스템 v2.0
 *
 * 완전히 재설계된 주간 배치 알고리즘
 * - 주 단위 배치 보장 (주4일/주5일)
 * - 형평성 설정 기반 선택적 적용
 * - 14단계 배치 프로세스
 */

import { prisma } from '@/lib/prisma'
import { classifyDayType } from '@/lib/utils/day-type-classifier'
import { calculateCategoryRequirements } from '@/lib/services/category-slot-service'
import { updateFairnessScoresAfterAssignment } from '@/lib/services/fairness-score-update-service'
import { createWeeklyAssignmentBackup } from '@/lib/services/assignment-backup-service'
import { validateWeeklyAssignment } from '@/lib/services/assignment-validation-service'
import {
  calculatePriority,
  getFairnessScore,
  saveWeeklyAssignments,
  saveUnresolvedIssues,
  loadUnresolvedIssues,
  tryFlexibleStaffAssignment,
  tryFillStaffShortage,
  checkIfJustified,
  getDateKey,
  updateWeekStatus
} from './weekly-assign-utils'

/**
 * 일별 요구사항 인터페이스
 */
interface DailyRequirement {
  dateKey: string
  date: Date
  dailySlotId: string
  requiredStaff: number
  departmentRequiredStaff: Record<string, number> // 부서별 필요 인원
  departmentCategoryStaff?: Record<string, Record<string, { count: number; minRequired: number }>> // 부서별 구분별 필요 인원 (신규)
  categoryRequirements: Record<string, number> // 레거시 호환용
  excludedStaff: Set<string> // 연차/오프로 제외된 직원들
  fairnessTypes: string[] // 적용할 형평성 유형들
  needsFairness: boolean
  priority: number
  hasNightShift: boolean
  currentAssignments: Array<{ staffId: string; category: string }>
}

/**
 * 직원 근무 현황 인터페이스
 */
interface StaffWorkStatus {
  required: number // 필요 근무일수 (4 or 5)
  current: number // 현재 배치된 일수
  leave: number // 연차/오프 일수
  needsMore: boolean // 추가 배치 필요 여부
}

/**
 * 검증 이슈 인터페이스
 */
interface ValidationIssue {
  type: string // 'SHORTAGE', 'EXCESS', 'UNFAIR', 'STAFF_SHORTAGE'
  severity: string // 'CRITICAL', 'WARNING', 'INFO'
  staffId?: string
  category?: string
  date?: Date
  message: string
  suggestion?: string
}

/**
 * 주간 배치 메인 함수
 *
 * @param weekInfoId - 주차 정보 ID
 * @returns 배치 결과 및 미해결 이슈
 */
export async function autoAssignWeeklySchedule(weekInfoId: string): Promise<{
  success: boolean
  message: string
  assignedCount: number
  unresolvedIssues: ValidationIssue[]
}> {
  try {
    // ========== Phase 1-3: 준비 단계 ==========

    // WeekInfo 로드
    const weekInfo = await prisma.weekInfo.findUnique({
      where: { id: weekInfoId },
      include: {
        dailySlots: {
          orderBy: { date: 'asc' }
        }
      }
    })

    if (!weekInfo || !weekInfo.dailySlots) {
      throw new Error('주차 정보를 찾을 수 없습니다')
    }

    const { clinicId, year, weekNumber } = weekInfo

    // 배치 전 백업 생성
    console.log('💾 배치 전 백업 생성 중...')
    await createWeeklyAssignmentBackup(
      weekInfoId,
      'AUTO_BEFORE_ASSIGN',
      `자동 배치 실행 전 백업 (${new Date().toLocaleString('ko-KR')})`
    )

    // 상태를 ASSIGNING으로 변경
    await updateWeekStatus(weekInfoId, 'ASSIGNING')

    // 이전 주차의 미해결 이슈 로드
    const previousWeekInfo = await prisma.weekInfo.findFirst({
      where: {
        clinicId,
        year,
        weekNumber: weekNumber - 1
      }
    })
    const previousIssues = await loadUnresolvedIssues(previousWeekInfo?.id || null)

    // === STEP 1: 필요 인원 계산 (구분별) ===
    console.log('📊 Step 1: 필요 인원 계산 중...')

    // 카테고리 비율 설정 로드
    const ratioSettings = await prisma.categoryRatioSettings.findUnique({
      where: { clinicId }
    })

    if (!ratioSettings) {
      throw new Error('카테고리 비율 설정이 없습니다')
    }

    const dailyRequirements: DailyRequirement[] = []

    for (const slot of weekInfo.dailySlots) {
      const categoryReqs = calculateCategoryRequirements(
        slot.requiredStaff,
        ratioSettings.ratios as Record<string, number>
      )

      // 부서별 필요 인원 가져오기
      const departmentReqs = (slot.departmentRequiredStaff as Record<string, number>) || {}

      // 부서별 구분별 필요 인원 가져오기 (신규)
      const departmentCategoryReqs = (slot.departmentCategoryStaff as Record<string, Record<string, { count: number; minRequired: number }>>) || undefined

      // doctorSchedule는 JSON 필드 - night_shift 확인
      const doctorSchedule = slot.doctorSchedule as any
      const hasNightShift = doctorSchedule?.night_shift === true

      dailyRequirements.push({
        dateKey: getDateKey(slot.date),
        date: slot.date,
        dailySlotId: slot.id,
        requiredStaff: slot.requiredStaff,
        departmentRequiredStaff: departmentReqs,
        departmentCategoryStaff: departmentCategoryReqs,
        categoryRequirements: categoryReqs,
        excludedStaff: new Set(),
        fairnessTypes: [],
        needsFairness: false,
        priority: 0,
        hasNightShift,
        currentAssignments: []
      })
    }

    // === STEP 2: 연차/오프 승인 인원 제외 ===
    console.log('🏖️ Step 2: 연차/오프 인원 제외 중...')

    const weekDates = dailyRequirements.map(d => d.date)
    const confirmedLeaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: { in: weekDates },
        status: 'CONFIRMED'
      },
      include: {
        staff: {
          select: { id: true, name: true }
        }
      }
    })

    // 날짜별 제외 직원 매핑
    for (const leave of confirmedLeaves) {
      const dateKey = getDateKey(leave.date)
      const dayReq = dailyRequirements.find(d => d.dateKey === dateKey)
      if (dayReq) {
        dayReq.excludedStaff.add(leave.staffId)
      }
    }

    console.log(`   → ${confirmedLeaves.length}건의 연차/오프 반영`)

    // === STEP 3: 형평성 필요 날짜 체크 (설정 기반) ===
    console.log('⚖️ Step 3: 형평성 필요 날짜 체크 중...')

    const fairnessSettings = await prisma.fairnessSettings.findUnique({
      where: { clinicId }
    })

    for (const day of dailyRequirements) {
      const dayTypes = await classifyDayType(clinicId, day.date)

      // 설정에 따라 형평성 유형 추가
      if (day.hasNightShift && fairnessSettings?.enableNightShiftFairness) {
        day.fairnessTypes.push('NIGHT_SHIFT')
      }
      if (dayTypes.includes('SATURDAY') && fairnessSettings?.enableWeekendFairness) {
        day.fairnessTypes.push('WEEKEND')
      }
      if (dayTypes.includes('HOLIDAY') && fairnessSettings?.enableHolidayFairness) {
        day.fairnessTypes.push('HOLIDAY')
      }
      if (
        (dayTypes.includes('HOLIDAY_ADJACENT') || dayTypes.includes('HOLIDAY_ADJACENT_SUNDAY')) &&
        fairnessSettings?.enableHolidayAdjacentFairness
      ) {
        day.fairnessTypes.push('HOLIDAY_ADJACENT')
      }

      day.needsFairness = day.fairnessTypes.length > 0
      day.priority = calculatePriority(day.fairnessTypes)
    }

    // 우선순위순으로 정렬 (형평성 필요 날짜 먼저)
    const sortedDays = [...dailyRequirements].sort((a, b) => {
      if (a.needsFairness && !b.needsFairness) return -1
      if (!a.needsFairness && b.needsFairness) return 1
      return b.priority - a.priority
    })

    console.log(`   → 형평성 필요 날짜: ${sortedDays.filter(d => d.needsFairness).length}일`)

    // ========== Phase 2: 우선 배치 (Step 4-5) ==========

    // 모든 활성 직원 로드
    const allActiveStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true
      },
      include: {
        fairnessScores: {
          where: { year },
          take: 1,
          orderBy: { year: 'desc' }
        }
      }
    })

    console.log(`👥 활성 직원: ${allActiveStaff.length}명`)

    // 주간 배치 추적 맵 초기화
    const weeklyAssignments = new Map<string, Set<string>>() // staffId → Set<dateKey>
    const staffWorkDayCount = new Map<string, StaffWorkStatus>() // staffId → 근무일수 현황
    const assignmentDetails = new Map<string, Array<{ staffId: string; category: string }>>() // dateKey → 배치 상세

    // 직원별 필요 근무일수 초기화
    for (const staff of allActiveStaff) {
      const requiredDays =
        staff.workType === 'WEEK_4' ? 4 :
        staff.workType === 'WEEK_5' ? 5 :
        staff.workDays || 4 // fallback to legacy field

      // 이번 주 연차/오프 일수 계산
      const leaveDays = confirmedLeaves.filter(l => l.staffId === staff.id).length

      staffWorkDayCount.set(staff.id, {
        required: requiredDays,
        current: 0,
        leave: leaveDays,
        needsMore: true
      })

      weeklyAssignments.set(staff.id, new Set())
    }

    // === STEP 4: 형평성 날짜부터 우선 배치 (부서별) ===
    console.log('🎯 Step 4: 형평성 날짜 우선 배치 중 (부서별)...')

    const fairnessDays = sortedDays.filter(d => d.needsFairness)
    let assignedCount = 0

    for (const day of fairnessDays) {
      console.log(`   처리 중: ${day.dateKey} (우선순위: ${day.priority}, 유형: ${day.fairnessTypes.join(', ')})`)

      // 이 날짜에 이미 배치된 직원 추적
      const assignedToday = new Set<string>()

      // 부서별로 배치 (departmentRequiredStaff가 있으면 부서별로, 없으면 전체)
      const hasDepartmentReqs = Object.keys(day.departmentRequiredStaff).length > 0

      if (hasDepartmentReqs) {
        // 부서별로 배치
        for (const [deptName, deptRequired] of Object.entries(day.departmentRequiredStaff)) {
          if (deptRequired === 0) continue // 자동배치 사용 안 함

          console.log(`     📦 부서: ${deptName} (필요 ${deptRequired}명)`)

          // departmentCategoryStaff가 있으면 우선 사용, 없으면 비율 계산
          const hasDeptCategoryStaff = day.departmentCategoryStaff && day.departmentCategoryStaff[deptName]

          if (hasDeptCategoryStaff) {
            // 신규: 부서별 구분별 설정 사용
            const deptCategoryConfig = day.departmentCategoryStaff![deptName]

            // 먼저 minRequired > 0인 카테고리 우선 배치
            const categoriesWithMinRequired = Object.entries(deptCategoryConfig)
              .filter(([_, config]) => config.minRequired > 0)
              .sort((a, b) => b[1].minRequired - a[1].minRequired) // 필수 인원 많은 순

            // 필수 인원 배치
            for (const [category, config] of categoriesWithMinRequired) {
              const minRequired = config.minRequired
              if (minRequired === 0) continue

              console.log(`        🔴 필수: ${category} (최소 ${minRequired}명)`)

              // 가용 직원 필터링 (기존 로직과 동일)
              const availableStaff = allActiveStaff.filter(staff => {
                if (staff.departmentName !== deptName) return false
                if (staff.categoryName !== category) return false
                if (day.excludedStaff.has(staff.id)) return false
                if (assignedToday.has(staff.id)) return false
                const assignedDates = weeklyAssignments.get(staff.id)
                if (assignedDates?.has(day.dateKey)) return false
                const workStatus = staffWorkDayCount.get(staff.id)
                if (workStatus) {
                  const totalDays = workStatus.current + workStatus.leave
                  if (totalDays >= workStatus.required) return false
                }
                return true
              })

              if (availableStaff.length === 0) {
                console.log(`           ⚠️ ${deptName}/${category}: 필수 인력 부족`)
                continue
              }

              // 형평성 점수로 정렬
              const staffWithScores = availableStaff.map(staff => ({
                staff,
                score: getFairnessScore(staff, day.fairnessTypes)
              }))
              staffWithScores.sort((a, b) => a.score - b.score)

              // 필수 인원만큼 배치
              const toAssign = staffWithScores.slice(0, Math.min(minRequired, availableStaff.length))

              toAssign.forEach(({ staff }) => {
                const dates = weeklyAssignments.get(staff.id)!
                dates.add(day.dateKey)
                assignedToday.add(staff.id)
                day.currentAssignments.push({ staffId: staff.id, category })
                const workStatus = staffWorkDayCount.get(staff.id)!
                workStatus.current++
                workStatus.needsMore = (workStatus.current + workStatus.leave) < workStatus.required
                assignedCount++
              })

              console.log(`           ✅ 필수 ${toAssign.length}명 배치`)
            }

            // 이제 일반 카테고리 배치 (필수 제외)
            for (const [category, config] of Object.entries(deptCategoryConfig)) {
              const targetCount = config.count
              const alreadyAssigned = day.currentAssignments.filter(
                a => a.category === category
              ).length

              const needMore = targetCount - alreadyAssigned
              if (needMore <= 0) continue

              console.log(`        ⚪ 일반: ${category} (목표 ${targetCount}명, 추가 ${needMore}명 필요)`)

              // 가용 직원 필터링
              const availableStaff = allActiveStaff.filter(staff => {
                if (staff.departmentName !== deptName) return false
                if (staff.categoryName !== category) return false
                if (day.excludedStaff.has(staff.id)) return false
                if (assignedToday.has(staff.id)) return false
                const assignedDates = weeklyAssignments.get(staff.id)
                if (assignedDates?.has(day.dateKey)) return false
                const workStatus = staffWorkDayCount.get(staff.id)
                if (workStatus) {
                  const totalDays = workStatus.current + workStatus.leave
                  if (totalDays >= workStatus.required) return false
                }
                return true
              })

              if (availableStaff.length === 0) {
                console.log(`           ⚠️ 가용 인력 없음`)
                continue
              }

              // 형평성 점수로 정렬
              const staffWithScores = availableStaff.map(staff => ({
                staff,
                score: getFairnessScore(staff, day.fairnessTypes)
              }))
              staffWithScores.sort((a, b) => a.score - b.score)

              // 필요 인원만큼 배치
              const toAssign = staffWithScores.slice(0, Math.min(needMore, availableStaff.length))

              toAssign.forEach(({ staff }) => {
                const dates = weeklyAssignments.get(staff.id)!
                dates.add(day.dateKey)
                assignedToday.add(staff.id)
                day.currentAssignments.push({ staffId: staff.id, category })
                const workStatus = staffWorkDayCount.get(staff.id)!
                workStatus.current++
                workStatus.needsMore = (workStatus.current + workStatus.leave) < workStatus.required
                assignedCount++
              })

              console.log(`           ✅ ${toAssign.length}명 배치`)
            }
          } else {
            // 레거시: 비율 계산 방식
            for (const [category, catRequired] of Object.entries(day.categoryRequirements)) {
              // 이 부서에서 이 카테고리의 필요 인원 계산 (비율로)
              const deptCategoryRequired = Math.round(catRequired * (deptRequired / day.requiredStaff))
              if (deptCategoryRequired === 0) continue

            // 가용 직원 필터링
            const availableStaff = allActiveStaff.filter(staff => {
              // 부서 불일치
              if (staff.departmentName !== deptName) return false

              // 카테고리 불일치
              if (staff.categoryName !== category) return false

              // 연차/오프로 제외됨
              if (day.excludedStaff.has(staff.id)) return false

              // 오늘 이미 배치됨
              if (assignedToday.has(staff.id)) return false

              // 이미 이 날짜에 배치됨 (다른 카테고리로)
              const assignedDates = weeklyAssignments.get(staff.id)
              if (assignedDates?.has(day.dateKey)) return false

              // 주간 근무일수 초과
              const workStatus = staffWorkDayCount.get(staff.id)
              if (workStatus) {
                const totalDays = workStatus.current + workStatus.leave
                if (totalDays >= workStatus.required) return false
              }

              return true
            })

            if (availableStaff.length === 0) {
              console.log(`        ⚠️ ${deptName}/${category}: 가용 인력 없음`)
              continue
            }

            // 형평성 점수로 정렬 (낮은 점수 우선)
            const staffWithScores = availableStaff.map(staff => ({
              staff,
              score: getFairnessScore(staff, day.fairnessTypes)
            }))

            staffWithScores.sort((a, b) => a.score - b.score)

            // 필요 인원만큼 배치
            const toAssign = staffWithScores.slice(0, deptCategoryRequired)

            toAssign.forEach(({ staff }) => {
              // 배치 기록
              const dates = weeklyAssignments.get(staff.id)!
              dates.add(day.dateKey)

              assignedToday.add(staff.id)

              day.currentAssignments.push({
                staffId: staff.id,
                category
              })

              // 근무일수 업데이트
              const workStatus = staffWorkDayCount.get(staff.id)!
              workStatus.current++
              workStatus.needsMore = (workStatus.current + workStatus.leave) < workStatus.required

              assignedCount++
            })

              console.log(`        ✅ ${deptName}/${category}: ${toAssign.length}명 배치`)
            }
          } // end if (hasDeptCategoryStaff)
        } // end for deptName
      } else {
        // 레거시: 부서 구분 없이 전체 배치
        for (const [category, required] of Object.entries(day.categoryRequirements)) {
          // 가용 직원 필터링
          const availableStaff = allActiveStaff.filter(staff => {
            // 카테고리 불일치
            if (staff.categoryName !== category) return false

            // 연차/오프로 제외됨
            if (day.excludedStaff.has(staff.id)) return false

            // 오늘 이미 배치됨
            if (assignedToday.has(staff.id)) return false

            // 이미 이 날짜에 배치됨 (다른 카테고리로)
            const assignedDates = weeklyAssignments.get(staff.id)
            if (assignedDates?.has(day.dateKey)) return false

            // 주간 근무일수 초과
            const workStatus = staffWorkDayCount.get(staff.id)
            if (workStatus) {
              const totalDays = workStatus.current + workStatus.leave
              if (totalDays >= workStatus.required) return false
            }

            return true
          })

        if (availableStaff.length === 0) {
          console.log(`      ⚠️ ${category}: 가용 인력 없음`)
          continue
        }

        // 형평성 점수로 정렬 (낮은 점수 우선)
        const staffWithScores = availableStaff.map(staff => ({
          staff,
          score: getFairnessScore(staff, day.fairnessTypes)
        }))

        staffWithScores.sort((a, b) => a.score - b.score)

        // 필요 인원만큼 배치
        const toAssign = staffWithScores.slice(0, required)

        toAssign.forEach(({ staff }) => {
          // 배치 기록
          const dates = weeklyAssignments.get(staff.id)!
          dates.add(day.dateKey)

          assignedToday.add(staff.id)

          day.currentAssignments.push({
            staffId: staff.id,
            category
          })

          // 근무일수 증가
          const workStatus = staffWorkDayCount.get(staff.id)!
          workStatus.current++

          assignedCount++
        })

          console.log(`      ✅ ${category}: ${toAssign.length}/${required}명 배치`)

          // 부족한 경우 Flexible Staff 시도
          if (toAssign.length < required) {
            const shortage = required - toAssign.length
            const result = await tryFlexibleStaffAssignment(
              clinicId,
              category,
              day.date,
              shortage,
              new Set([...Array.from(assignedToday), ...Array.from(day.excludedStaff)]),
              weeklyAssignments,
              staffWorkDayCount
            )

          if (result.success && result.assignedStaff) {
            result.assignedStaff.forEach(staff => {
              assignedToday.add(staff.id)
              day.currentAssignments.push({
                staffId: staff.id,
                category
              })
              assignedCount++
            })
            console.log(`      ✅ Flexible: ${result.assignedStaff.length}명 추가 배치`)
          }
        }
        }
      }

      // 이 날짜의 배치 상세 저장
      assignmentDetails.set(day.dateKey, day.currentAssignments)
    }

    console.log(`   → 형평성 날짜 총 ${assignedCount}명 배치 완료`)

    // === STEP 5: 전체 근무일수 체크 ===
    console.log('📋 Step 5: 근무일수 체크 중...')

    staffWorkDayCount.forEach((status, staffId) => {
      const totalDays = status.current + status.leave
      status.needsMore = totalDays < status.required
    })

    const needsMoreStaff = Array.from(staffWorkDayCount.entries())
      .filter(([_, status]) => status.needsMore)
      .map(([staffId, _]) => staffId)

    console.log(`   → 추가 배치 필요 직원: ${needsMoreStaff.length}명`)

    // ========== Phase 3: 보충 배치 (Step 6-7) ==========

    // === STEP 6: 부족 인원 우선 배치 (부서별 고려) ===
    console.log('🔄 Step 6: 근무일수 부족 직원 우선 배치 중...')

    // 나머지 날짜들 (형평성 날짜 제외)
    const remainingDays = sortedDays.filter(d => !d.needsFairness)

    for (const staffId of needsMoreStaff) {
      const staff = allActiveStaff.find(s => s.id === staffId)
      if (!staff || !staff.categoryName) continue

      const result = await tryFillStaffShortage(
        staffId,
        remainingDays.map(d => ({
          dateKey: d.dateKey,
          date: d.date,
          categoryRequirements: d.categoryRequirements,
          currentAssignments: assignmentDetails.get(d.dateKey)?.length || 0,
          departmentRequiredStaff: d.departmentRequiredStaff, // 부서별 필요 인원 전달
          departmentName: staff.departmentName // 직원 부서 전달
        })),
        weeklyAssignments,
        assignmentDetails,
        staffWorkDayCount,
        staff.categoryName
      )

      if (result.success && result.assignedDates) {
        assignedCount += result.assignedDates.length
        console.log(`   ✅ ${staff.name}: ${result.assignedDates.length}일 추가 배치`)
      }
    }

    // === STEP 7: 나머지 날짜 배치 (부서별) ===
    console.log('📅 Step 7: 나머지 날짜 배치 중 (부서별)...')

    for (const day of remainingDays) {
      const assignedToday = new Set<string>()
      const existingAssignments = assignmentDetails.get(day.dateKey) || []
      existingAssignments.forEach(a => assignedToday.add(a.staffId))

      // 부서별 배치 여부 확인
      const hasDepartmentReqs = Object.keys(day.departmentRequiredStaff).length > 0

      if (hasDepartmentReqs) {
        // 부서별로 배치
        for (const [deptName, deptRequired] of Object.entries(day.departmentRequiredStaff)) {
          if (deptRequired === 0) continue

          for (const [category, catRequired] of Object.entries(day.categoryRequirements)) {
            const deptCategoryRequired = Math.round(catRequired * (deptRequired / day.requiredStaff))
            if (deptCategoryRequired === 0) continue

            const alreadyAssigned = existingAssignments.filter(a =>
              a.category === category &&
              allActiveStaff.find(s => s.id === a.staffId)?.departmentName === deptName
            ).length
            const needed = deptCategoryRequired - alreadyAssigned

            if (needed <= 0) continue

            // 가용 직원 필터링
            const availableStaff = allActiveStaff.filter(staff => {
              if (staff.departmentName !== deptName) return false
              if (staff.categoryName !== category) return false
              if (day.excludedStaff.has(staff.id)) return false
              if (assignedToday.has(staff.id)) return false

              const assignedDates = weeklyAssignments.get(staff.id)
              if (assignedDates?.has(day.dateKey)) return false

              const workStatus = staffWorkDayCount.get(staff.id)
              if (workStatus) {
                const totalDays = workStatus.current + workStatus.leave
                if (totalDays >= workStatus.required) return false
              }

              return true
            })

            // 근무일수 부족한 직원 우선
            availableStaff.sort((a, b) => {
              const statusA = staffWorkDayCount.get(a.id)!
              const statusB = staffWorkDayCount.get(b.id)!
              const shortageA = statusA.required - (statusA.current + statusA.leave)
              const shortageB = statusB.required - (statusB.current + statusB.leave)
              return shortageB - shortageA
            })

            const toAssign = availableStaff.slice(0, needed)

            toAssign.forEach(staff => {
              const dates = weeklyAssignments.get(staff.id)!
              dates.add(day.dateKey)
              assignedToday.add(staff.id)

              existingAssignments.push({
                staffId: staff.id,
                category
              })

              const workStatus = staffWorkDayCount.get(staff.id)!
              workStatus.current++

              assignedCount++
            })

            console.log(`   ${day.dateKey} - ${deptName}/${category}: ${toAssign.length}/${needed}명 배치`)
          }
        }
      } else {
        // 레거시: 부서 구분 없이 배치
        for (const [category, required] of Object.entries(day.categoryRequirements)) {
          const alreadyAssigned = existingAssignments.filter(a => a.category === category).length
          const needed = required - alreadyAssigned

          if (needed <= 0) continue

          // 가용 직원 필터링
          const availableStaff = allActiveStaff.filter(staff => {
            if (staff.categoryName !== category) return false
            if (day.excludedStaff.has(staff.id)) return false
            if (assignedToday.has(staff.id)) return false

            const assignedDates = weeklyAssignments.get(staff.id)
            if (assignedDates?.has(day.dateKey)) return false

            const workStatus = staffWorkDayCount.get(staff.id)
            if (workStatus) {
              const totalDays = workStatus.current + workStatus.leave
              if (totalDays >= workStatus.required) return false
            }

            return true
          })

        // 근무일수 부족한 직원 우선
        availableStaff.sort((a, b) => {
          const statusA = staffWorkDayCount.get(a.id)!
          const statusB = staffWorkDayCount.get(b.id)!
          const shortageA = statusA.required - (statusA.current + statusA.leave)
          const shortageB = statusB.required - (statusB.current + statusB.leave)
          return shortageB - shortageA
        })

        const toAssign = availableStaff.slice(0, needed)

        toAssign.forEach(staff => {
          const dates = weeklyAssignments.get(staff.id)!
          dates.add(day.dateKey)
          assignedToday.add(staff.id)

          existingAssignments.push({
            staffId: staff.id,
            category
          })

          const workStatus = staffWorkDayCount.get(staff.id)!
          workStatus.current++

          assignedCount++
        })

        console.log(`   ${day.dateKey} - ${category}: ${toAssign.length}/${needed}명 배치`)

        // Flexible staff 시도
        if (toAssign.length < needed) {
          const shortage = needed - toAssign.length
          const result = await tryFlexibleStaffAssignment(
            clinicId,
            category,
            day.date,
            shortage,
            new Set([...Array.from(assignedToday), ...Array.from(day.excludedStaff)]),
            weeklyAssignments,
            staffWorkDayCount
          )

          if (result.success && result.assignedStaff) {
            result.assignedStaff.forEach(staff => {
              assignedToday.add(staff.id)
              existingAssignments.push({
                staffId: staff.id,
                category
              })
              assignedCount++
            })
          }
        }
      }

      assignmentDetails.set(day.dateKey, existingAssignments)
    }

    console.log(`   → 총 ${assignedCount}명 배치 완료`)

    // ========== Phase 4: 검증 및 조율 (Step 8-10) ==========

    const validationIssues: ValidationIssue[] = []

    // === STEP 8: 배치 검증 (부서별) ===
    console.log('🔍 Step 8: 배치 검증 중...')

    // 8-1. 슬롯 인원 검증 (부서별)
    for (const day of dailyRequirements) {
      const assignments = assignmentDetails.get(day.dateKey) || []
      const hasDepartmentReqs = Object.keys(day.departmentRequiredStaff).length > 0

      if (hasDepartmentReqs) {
        // 부서별 검증
        for (const [deptName, deptRequired] of Object.entries(day.departmentRequiredStaff)) {
          if (deptRequired === 0) continue // 자동배치 사용 안 함

          // 이 부서에 배정된 직원 수 확인
          const deptAssignments = assignments.filter(a => {
            const staff = allActiveStaff.find(s => s.id === a.staffId)
            return staff?.departmentName === deptName
          })

          if (deptAssignments.length < deptRequired) {
            validationIssues.push({
              type: 'SHORTAGE',
              severity: 'CRITICAL',
              category: deptName,
              date: day.date,
              message: `${day.dateKey} [${deptName}] 부서 인원 부족: ${deptAssignments.length}/${deptRequired}`,
              suggestion: 'Flexible staff 재확인 필요'
            })
          } else if (deptAssignments.length > deptRequired) {
            validationIssues.push({
              type: 'EXCESS',
              severity: 'WARNING',
              category: deptName,
              date: day.date,
              message: `${day.dateKey} [${deptName}] 부서 인원 초과: ${deptAssignments.length}/${deptRequired}`,
              suggestion: '배치 조정 필요'
            })
          }

          // 부서 내 카테고리별 검증
          for (const [category, catRequired] of Object.entries(day.categoryRequirements)) {
            const deptCategoryRequired = Math.round(catRequired * (deptRequired / day.requiredStaff))
            if (deptCategoryRequired === 0) continue

            const assigned = deptAssignments.filter(a => a.category === category).length

            if (assigned < deptCategoryRequired) {
              validationIssues.push({
                type: 'SHORTAGE',
                severity: 'WARNING',
                category: `${deptName}-${category}`,
                date: day.date,
                message: `${day.dateKey} [${deptName}] ${category} 인원 부족: ${assigned}/${deptCategoryRequired}`,
                suggestion: '카테고리별 조정 필요'
              })
            }
          }
        }
      } else {
        // 레거시: 전체 카테고리별 검증
        for (const [category, required] of Object.entries(day.categoryRequirements)) {
          const assigned = assignments.filter(a => a.category === category).length

          if (assigned < required) {
            validationIssues.push({
              type: 'SHORTAGE',
              severity: 'CRITICAL',
              category,
              date: day.date,
              message: `${day.dateKey} ${category} 인원 부족: ${assigned}/${required}`,
              suggestion: 'Flexible staff 재확인 필요'
            })
          } else if (assigned > required) {
            validationIssues.push({
              type: 'EXCESS',
              severity: 'WARNING',
              category,
              date: day.date,
              message: `${day.dateKey} ${category} 인원 초과: ${assigned}/${required}`,
              suggestion: '배치 조정 필요'
            })
          }
        }
      }
    }

    // 8-2. 직원별 근무일수 검증
    for (const [staffId, workStatus] of staffWorkDayCount.entries()) {
      const staff = allActiveStaff.find(s => s.id === staffId)
      if (!staff) continue

      const totalDays = workStatus.current + workStatus.leave

      if (totalDays < workStatus.required) {
        validationIssues.push({
          type: 'STAFF_SHORTAGE',
          severity: 'WARNING',
          staffId,
          message: `${staff.name} 근무일수 부족: ${totalDays}/${workStatus.required} (근무 ${workStatus.current}, 연차 ${workStatus.leave})`,
          suggestion: '가용 날짜 재확인 또는 다음 주 조정'
        })
      } else if (workStatus.current > workStatus.required) {
        validationIssues.push({
          type: 'EXCESS',
          severity: 'INFO',
          staffId,
          message: `${staff.name} 근무일수 초과: ${workStatus.current}/${workStatus.required}`,
          suggestion: '형평성 조정 필요'
        })
      }
    }

    // 8-3. 형평성 검증
    for (const day of fairnessDays) {
      const assignments = assignmentDetails.get(day.dateKey) || []

      // 형평성 점수 편차 확인
      const assignedStaffScores = assignments.map(a => {
        const staff = allActiveStaff.find(s => s.id === a.staffId)
        return staff ? getFairnessScore(staff, day.fairnessTypes) : 0
      })

      if (assignedStaffScores.length > 0) {
        const maxScore = Math.max(...assignedStaffScores)
        const minScore = Math.min(...assignedStaffScores)
        const diff = maxScore - minScore

        // 점수 차이가 3 이상이면 불공평
        if (diff > 3) {
          validationIssues.push({
            type: 'UNFAIR',
            severity: 'INFO',
            date: day.date,
            message: `${day.dateKey} 형평성 불균형: 점수 편차 ${diff}`,
            suggestion: '차주 또는 익월 형평성 조정'
          })
        }
      }
    }

    console.log(`   → 발견된 이슈: ${validationIssues.length}건`)
    console.log(`      - CRITICAL: ${validationIssues.filter(i => i.severity === 'CRITICAL').length}건`)
    console.log(`      - WARNING: ${validationIssues.filter(i => i.severity === 'WARNING').length}건`)
    console.log(`      - INFO: ${validationIssues.filter(i => i.severity === 'INFO').length}건`)

    // === STEP 9: 조율 시도 ===
    console.log('🔧 Step 9: 이슈 조율 시도 중...')

    const unresolvedIssues: ValidationIssue[] = []
    const criticalIssues = validationIssues.filter(i => i.severity === 'CRITICAL')

    for (const issue of criticalIssues) {
      console.log(`   조율 시도: ${issue.message}`)

      // SHORTAGE 이슈: Flexible staff 재시도
      if (issue.type === 'SHORTAGE' && issue.category && issue.date) {
        const day = dailyRequirements.find(d => d.dateKey === getDateKey(issue.date!))
        if (!day) continue

        const assignments = assignmentDetails.get(day.dateKey) || []
        const assigned = assignments.filter(a => a.category === issue.category).length
        const required = day.categoryRequirements[issue.category!]
        const shortage = required - assigned

        if (shortage > 0) {
          const assignedToday = new Set(assignments.map(a => a.staffId))
          const result = await tryFlexibleStaffAssignment(
            clinicId,
            issue.category,
            issue.date,
            shortage,
            new Set([...assignedToday, ...Array.from(day.excludedStaff)]),
            weeklyAssignments,
            staffWorkDayCount
          )

          if (result.success && result.assignedStaff) {
            console.log(`      ✅ 해결: ${result.assignedStaff.length}명 추가 배치`)

            result.assignedStaff.forEach(staff => {
              assignments.push({
                staffId: staff.id,
                category: issue.category!
              })
            })

            assignmentDetails.set(day.dateKey, assignments)
            continue
          }
        }
      }

      // 조율 실패한 이슈는 미해결 목록에 추가
      unresolvedIssues.push(issue)
    }

    // WARNING 및 INFO 이슈는 정당성 확인 후 처리
    const nonCriticalIssues = validationIssues.filter(i => i.severity !== 'CRITICAL')

    for (const issue of nonCriticalIssues) {
      const justified = await checkIfJustified(
        issue,
        staffWorkDayCount,
        confirmedLeaves
      )

      if (justified.valid) {
        console.log(`   ℹ️ 정당한 이슈: ${issue.message} (${justified.reason})`)
        unresolvedIssues.push({
          ...issue,
          suggestion: justified.reason
        })
      } else {
        console.log(`   ⚠️ 재조율 필요: ${issue.message}`)
        unresolvedIssues.push(issue)
      }
    }

    console.log(`   → 미해결 이슈: ${unresolvedIssues.length}건`)

    // === STEP 10: 차주 반영 or 완료 ===
    console.log('📝 Step 10: 결과 저장 중...')

    // 배치 저장
    const dailySlots = new Map<string, { id: string; date: Date }>(
      weekInfo.dailySlots.map(s => [getDateKey(s.date), { id: s.id, date: s.date }])
    )
    await saveWeeklyAssignments(weeklyAssignments, dailySlots, assignmentDetails)

    // 미해결 이슈 저장
    if (unresolvedIssues.length > 0) {
      await saveUnresolvedIssues(
        weekInfoId,
        unresolvedIssues.map(issue => ({
          issueType: issue.type,
          severity: issue.severity,
          staffId: issue.staffId,
          category: issue.category,
          date: issue.date,
          message: issue.message,
          suggestion: issue.suggestion,
          status: issue.severity === 'CRITICAL' ? 'PENDING_NEXT_WEEK' : 'CARRY_TO_NEXT_MONTH'
        }))
      )
    }

    // 상태 업데이트
    const hasCriticalIssues = unresolvedIssues.some(i => i.severity === 'CRITICAL')
    await updateWeekStatus(
      weekInfoId,
      hasCriticalIssues ? 'DRAFT' : 'COMPLETED'
    )

    // 형평성 점수 업데이트 (배치 성공 시에만)
    if (!hasCriticalIssues) {
      try {
        await updateFairnessScoresAfterAssignment(weekInfoId)
      } catch (error) {
        console.error('형평성 점수 업데이트 오류:', error)
        // 점수 업데이트 실패는 배치 실패로 간주하지 않음
      }

      // 배치 후 백업 생성
      console.log('💾 배치 후 백업 생성 중...')
      await createWeeklyAssignmentBackup(
        weekInfoId,
        'AUTO_AFTER_ASSIGN',
        `자동 배치 완료 후 백업 (${new Date().toLocaleString('ko-KR')})`
      )

      // 배치 후 검증
      console.log('🔍 배치 후 검증 실행 중...')
      const validation = await validateWeeklyAssignment(weekInfoId, 'POST_ASSIGN', true)

      if (validation.criticalCount > 0) {
        console.log(`   ⚠️ 검증에서 ${validation.criticalCount}건의 CRITICAL 이슈 발견`)
        console.log(`   자동 수정 ${validation.autoFixSuccess ? '성공' : '실패'}`)
      }
    }

    const resultMessage = hasCriticalIssues
      ? `주간 배치 실패: ${unresolvedIssues.filter(i => i.severity === 'CRITICAL').length}건의 심각한 이슈`
      : `주간 배치 완료: ${assignedCount}명 배치, ${unresolvedIssues.length}건의 경미한 이슈`

    console.log(`✅ ${resultMessage}`)

    return {
      success: !hasCriticalIssues,
      message: resultMessage,
      assignedCount,
      unresolvedIssues
    }
  } catch (error) {
    console.error('Weekly assignment error:', error)

    // 상태 롤백
    await updateWeekStatus(weekInfoId, 'DRAFT')

    throw error
  }
}
