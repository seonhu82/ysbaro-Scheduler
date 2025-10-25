/**
 * 배치 검증 강화 서비스
 *
 * 주기적인 배치 검증 및 자동 수정 기능을 제공합니다.
 */

import { prisma } from '@/lib/prisma'

interface ValidationIssue {
  type: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  staffId?: string
  staffName?: string
  category?: string
  date?: Date
  message: string
  suggestion?: string
}

/**
 * 주간 배치 검증 실행
 *
 * @param weekInfoId - 주차 정보 ID
 * @param validationType - 검증 타입
 * @param autoFix - 자동 수정 시도 여부
 * @returns 검증 결과
 */
export async function validateWeeklyAssignment(
  weekInfoId: string,
  validationType: 'PRE_ASSIGN' | 'POST_ASSIGN' | 'PERIODIC_CHECK',
  autoFix: boolean = false
): Promise<{
  success: boolean
  issues: ValidationIssue[]
  criticalCount: number
  warningCount: number
  infoCount: number
  autoFixSuccess?: boolean
  autoFixLog?: string
}> {
  console.log(`\n🔍 배치 검증 시작: ${validationType}`)

  const issues: ValidationIssue[] = []

  // 주차 정보 로드
  const weekInfo = await prisma.weekInfo.findUnique({
    where: { id: weekInfoId },
    include: {
      dailySlots: {
        include: {
          staffAssignments: {
            include: {
              staff: {
                select: {
                  id: true,
                  name: true,
                  categoryName: true,
                  workType: true,
                  workDays: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!weekInfo) {
    throw new Error('주차 정보를 찾을 수 없습니다')
  }

  const { clinicId, year, month } = weekInfo

  // === 검증 1: 슬롯 인원 검증 ===
  console.log('   1. 슬롯 인원 검증 중...')

  for (const slot of weekInfo.dailySlots) {
    const assigned = slot.staffAssignments.length
    const required = slot.requiredStaff

    if (assigned < required) {
      issues.push({
        type: 'SLOT_SHORTAGE',
        severity: 'CRITICAL',
        date: slot.date,
        message: `${slot.date.toISOString().split('T')[0]}: 배치 인원 부족 (${assigned}/${required}명)`,
        suggestion: 'Flexible staff 배치 또는 필요 인원 재검토 필요'
      })
    } else if (assigned > required) {
      issues.push({
        type: 'SLOT_EXCESS',
        severity: 'WARNING',
        date: slot.date,
        message: `${slot.date.toISOString().split('T')[0]}: 배치 인원 초과 (${assigned}/${required}명)`,
        suggestion: '초과 인원 재조정 권장'
      })
    }
  }

  // === 검증 2: 직원별 근무일수 검증 ===
  console.log('   2. 직원별 근무일수 검증 중...')

  const staffWorkDays = new Map<string, number>()

  for (const slot of weekInfo.dailySlots) {
    for (const assignment of slot.staffAssignments) {
      const count = staffWorkDays.get(assignment.staffId) || 0
      staffWorkDays.set(assignment.staffId, count + 1)
    }
  }

  // 연차/오프 확인
  const weekDates = weekInfo.dailySlots.map(s => s.date)
  const confirmedLeaves = await prisma.leaveApplication.findMany({
    where: {
      clinicId,
      date: { in: weekDates },
      status: 'CONFIRMED'
    },
    include: {
      staff: { select: { id: true, name: true } }
    }
  })

  const staffLeaveDays = new Map<string, number>()
  for (const leave of confirmedLeaves) {
    const count = staffLeaveDays.get(leave.staffId) || 0
    staffLeaveDays.set(leave.staffId, count + 1)
  }

  // 모든 활성 직원 조회
  const allStaff = await prisma.staff.findMany({
    where: { clinicId, isActive: true }
  })

  for (const staff of allStaff) {
    const requiredDays =
      staff.workType === 'WEEK_4' ? 4 :
      staff.workType === 'WEEK_5' ? 5 :
      staff.workDays || 4

    const assignedDays = staffWorkDays.get(staff.id) || 0
    const leaveDays = staffLeaveDays.get(staff.id) || 0
    const totalDays = assignedDays + leaveDays

    if (totalDays < requiredDays) {
      const shortage = requiredDays - totalDays

      issues.push({
        type: 'STAFF_SHORTAGE',
        severity: shortage >= 2 ? 'WARNING' : 'INFO',
        staffId: staff.id,
        staffName: staff.name,
        message: `${staff.name}: 근무일수 부족 (${totalDays}/${requiredDays}일, 부족 ${shortage}일)`,
        suggestion: '추가 배치 가능 날짜 확인 또는 다음 주 조정'
      })
    } else if (assignedDays > requiredDays) {
      const excess = assignedDays - requiredDays

      issues.push({
        type: 'STAFF_EXCESS',
        severity: 'INFO',
        staffId: staff.id,
        staffName: staff.name,
        message: `${staff.name}: 근무일수 초과 (${assignedDays}/${requiredDays}일, 초과 ${excess}일)`,
        suggestion: '형평성 조정 고려'
      })
    }
  }

  // === 검증 3: 중복 배치 검증 ===
  console.log('   3. 중복 배치 검증 중...')

  for (const slot of weekInfo.dailySlots) {
    const staffIds = slot.staffAssignments.map(a => a.staffId)
    const uniqueIds = new Set(staffIds)

    if (staffIds.length !== uniqueIds.size) {
      const duplicates = staffIds.filter((id, index) => staffIds.indexOf(id) !== index)

      for (const staffId of duplicates) {
        const staff = allStaff.find(s => s.id === staffId)

        issues.push({
          type: 'DUPLICATE_ASSIGNMENT',
          severity: 'CRITICAL',
          staffId,
          staffName: staff?.name,
          date: slot.date,
          message: `${slot.date.toISOString().split('T')[0]}: ${staff?.name || staffId} 중복 배치 발견`,
          suggestion: '즉시 수정 필요'
        })
      }
    }
  }

  // === 검증 4: 카테고리별 인원 검증 ===
  console.log('   4. 카테고리별 인원 검증 중...')

  const ratioSettings = await prisma.categoryRatioSettings.findUnique({
    where: { clinicId }
  })

  if (ratioSettings) {
    for (const slot of weekInfo.dailySlots) {
      const requiredCategories = calculateCategoryRequirements(
        slot.requiredStaff,
        ratioSettings.ratios as Record<string, number>
      )

      const actualCategories: Record<string, number> = {}

      for (const assignment of slot.staffAssignments) {
        const category = assignment.staff.categoryName || '미분류'
        actualCategories[category] = (actualCategories[category] || 0) + 1
      }

      for (const [category, required] of Object.entries(requiredCategories)) {
        const actual = actualCategories[category] || 0

        if (actual < required) {
          issues.push({
            type: 'CATEGORY_SHORTAGE',
            severity: 'WARNING',
            category,
            date: slot.date,
            message: `${slot.date.toISOString().split('T')[0]}: ${category} 부족 (${actual}/${required}명)`,
            suggestion: 'Flexible staff 또는 카테고리 재조정'
          })
        }
      }
    }
  }

  // === 검증 5: 연차/오프 충돌 검증 ===
  console.log('   5. 연차/오프 충돌 검증 중...')

  for (const leave of confirmedLeaves) {
    for (const slot of weekInfo.dailySlots) {
      if (slot.date.getTime() === leave.date.getTime()) {
        const isAssigned = slot.staffAssignments.some(a => a.staffId === leave.staffId)

        if (isAssigned) {
          issues.push({
            type: 'LEAVE_CONFLICT',
            severity: 'CRITICAL',
            staffId: leave.staffId,
            staffName: leave.staff.name,
            date: slot.date,
            message: `${slot.date.toISOString().split('T')[0]}: ${leave.staff.name} 연차/오프 승인 상태인데 배치됨`,
            suggestion: '즉시 배치 제거 필요'
          })
        }
      }
    }
  }

  // 통계
  const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length
  const warningCount = issues.filter(i => i.severity === 'WARNING').length
  const infoCount = issues.filter(i => i.severity === 'INFO').length

  console.log(`   → 발견된 이슈: 총 ${issues.length}건`)
  console.log(`      - CRITICAL: ${criticalCount}건`)
  console.log(`      - WARNING: ${warningCount}건`)
  console.log(`      - INFO: ${infoCount}건`)

  // === 자동 수정 시도 ===
  let autoFixSuccess = false
  let autoFixLog = ''

  if (autoFix && criticalCount > 0) {
    console.log('\n   🔧 자동 수정 시도 중...')

    const fixResult = await attemptAutoFix(weekInfoId, issues)
    autoFixSuccess = fixResult.success
    autoFixLog = fixResult.log
  }

  // 검증 로그 저장
  await prisma.assignmentValidationLog.create({
    data: {
      weekInfoId,
      validationType,
      severity: criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'WARNING' : 'INFO',
      issueCount: issues.length,
      criticalCount,
      warningCount,
      infoCount,
      issues: JSON.parse(JSON.stringify(issues)), // JSON으로 변환
      autoFixAttempted: autoFix,
      autoFixSuccess,
      autoFixLog
    }
  })

  return {
    success: criticalCount === 0,
    issues,
    criticalCount,
    warningCount,
    infoCount,
    autoFixSuccess,
    autoFixLog
  }
}

/**
 * 카테고리별 필요 인원 계산
 */
function calculateCategoryRequirements(
  totalRequired: number,
  ratios: Record<string, number>
): Record<string, number> {
  const requirements: Record<string, number> = {}

  for (const [category, ratio] of Object.entries(ratios)) {
    requirements[category] = Math.round(totalRequired * (ratio / 100))
  }

  // 반올림으로 인한 오차 조정
  const total = Object.values(requirements).reduce((a, b) => a + b, 0)
  if (total !== totalRequired) {
    const diff = totalRequired - total
    const firstCategory = Object.keys(requirements)[0]
    requirements[firstCategory] += diff
  }

  return requirements
}

/**
 * 자동 수정 시도
 */
async function attemptAutoFix(
  weekInfoId: string,
  issues: ValidationIssue[]
): Promise<{ success: boolean; log: string }> {
  const log: string[] = []
  let fixedCount = 0

  // CRITICAL 이슈만 자동 수정 시도
  const criticalIssues = issues.filter(i => i.severity === 'CRITICAL')

  for (const issue of criticalIssues) {
    try {
      if (issue.type === 'DUPLICATE_ASSIGNMENT' && issue.staffId && issue.date) {
        // 중복 배치 제거
        const slot = await prisma.dailySlot.findFirst({
          where: {
            weekId: weekInfoId,
            date: issue.date
          }
        })

        if (slot) {
          const assignments = await prisma.dailyStaffAssignment.findMany({
            where: {
              dailySlotId: slot.id,
              staffId: issue.staffId
            }
          })

          if (assignments.length > 1) {
            // 첫 번째만 남기고 나머지 삭제
            const toDelete = assignments.slice(1).map(a => a.id)

            await prisma.dailyStaffAssignment.deleteMany({
              where: { id: { in: toDelete } }
            })

            log.push(`✅ 중복 배치 수정: ${issue.staffName} (${issue.date?.toISOString().split('T')[0]})`)
            fixedCount++
          }
        }
      } else if (issue.type === 'LEAVE_CONFLICT' && issue.staffId && issue.date) {
        // 연차/오프 충돌 배치 제거
        const slot = await prisma.dailySlot.findFirst({
          where: {
            weekId: weekInfoId,
            date: issue.date
          }
        })

        if (slot) {
          await prisma.dailyStaffAssignment.deleteMany({
            where: {
              dailySlotId: slot.id,
              staffId: issue.staffId
            }
          })

          log.push(`✅ 연차/오프 충돌 수정: ${issue.staffName} (${issue.date?.toISOString().split('T')[0]})`)
          fixedCount++
        }
      }
    } catch (error: any) {
      log.push(`❌ 수정 실패 (${issue.type}): ${error.message}`)
    }
  }

  const success = fixedCount > 0
  const logText = log.join('\n') + `\n\n총 ${fixedCount}건 자동 수정 완료`

  console.log(`   ${success ? '✅' : '⚠️'} 자동 수정 결과: ${fixedCount}/${criticalIssues.length}건 수정`)

  return { success, log: logText }
}

/**
 * 주간 배치 전체 검증 (모든 주차)
 *
 * @param clinicId - 병원 ID
 * @param year - 연도
 * @param month - 월
 */
export async function validateAllWeeksInMonth(
  clinicId: string,
  year: number,
  month: number
): Promise<{
  totalWeeks: number
  validWeeks: number
  invalidWeeks: Array<{ weekInfoId: string; weekNumber: number; issueCount: number }>
}> {
  const weeks = await prisma.weekInfo.findMany({
    where: { clinicId, year, month },
    orderBy: { weekNumber: 'asc' }
  })

  const invalidWeeks: Array<{ weekInfoId: string; weekNumber: number; issueCount: number }> = []

  for (const week of weeks) {
    const result = await validateWeeklyAssignment(week.id, 'PERIODIC_CHECK')

    if (!result.success) {
      invalidWeeks.push({
        weekInfoId: week.id,
        weekNumber: week.weekNumber,
        issueCount: result.criticalCount
      })
    }
  }

  return {
    totalWeeks: weeks.length,
    validWeeks: weeks.length - invalidWeeks.length,
    invalidWeeks
  }
}
