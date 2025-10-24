// 기본 자동 배치 알고리즘
import { prisma } from '@/lib/prisma'
import { getFlexibleStaff, calculateCategoryRequirements } from '@/lib/services/category-slot-service'
import { classifyDayType } from '@/lib/utils/day-type-classifier'

export async function autoAssignSingleSlot(slotId: string) {
  const assignments: any[] = []
  const errors: string[] = []

  try {
    // 1. DailySlot 조회
    const slot = await prisma.dailySlot.findUnique({
      where: { id: slotId },
      include: {
        week: { include: { clinic: true } }
      }
    })

    if (!slot) {
      return { success: false, errors: ['Slot not found'], assignments: [] }
    }

    const clinicId = slot.week.clinicId
    const requiredStaff = slot.requiredStaff
    const date = slot.date

    // 2. CategoryRatioSettings 조회
    const ratioSettings = await prisma.categoryRatioSettings.findUnique({
      where: { clinicId }
    })

    if (!ratioSettings) {
      return {
        success: false,
        errors: ['Category ratio settings not found'],
        assignments: []
      }
    }

    const ratios = ratioSettings.ratios as { [key: string]: number }

    // 3. 구분별 필요 인원 계산
    const categoryRequirements = calculateCategoryRequirements(requiredStaff, ratios)

    // 4. 날짜 유형 분류 (형평성 계산용)
    const dayTypes = await classifyDayType(clinicId, date)

    // 5. 각 구분별로 직원 배치
    for (const [category, required] of Object.entries(categoryRequirements)) {
      // 5.1 해당 구분 직원 조회 (오프 신청 안한 사람, 활성 직원)
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
        },
        include: {
          fairnessScores: {
            where: {
              year: date.getFullYear(),
              month: date.getMonth() + 1
            }
          }
        }
      })

      // 5.2 형평성 기반 정렬
      const staffWithScores = availableStaff.map((staff) => {
        const fairnessScore = staff.fairnessScores[0]
        let score = 0

        // 날짜 유형에 따라 해당 형평성 점수 사용
        const doctorSchedule = slot.doctorSchedule as any
        const hasNightShift = doctorSchedule?.night_shift || false

        if (dayTypes.includes('HOLIDAY')) {
          score = fairnessScore?.holidayCount || 0
        } else if (dayTypes.includes('HOLIDAY_ADJACENT')) {
          score = fairnessScore?.holidayAdjacentCount || 0
        } else if (dayTypes.includes('SATURDAY') || dayTypes.includes('SUNDAY')) {
          score = fairnessScore?.weekendCount || 0
        } else if (hasNightShift) {
          score = fairnessScore?.nightShiftCount || 0
        }

        return { staff, score }
      })

      // 점수가 낮은 순으로 정렬 (형평성을 위해)
      staffWithScores.sort((a, b) => a.score - b.score)
      const sortedStaff = staffWithScores.map(s => s.staff)

      // 5.3 배치
      const assigned = sortedStaff.slice(0, required)
      assignments.push(...assigned.map(s => ({ staffId: s.id, slotId })))

      // 5.4 부족하면 flexible staff 활용
      if (assigned.length < required) {
        const shortfall = required - assigned.length
        const assignedIds = assigned.map(s => s.id)

        const flexibleStaff = await getFlexibleStaff(
          clinicId,
          category,
          assignedIds
        )

        // Flexible staff도 형평성 기반 정렬
        const flexWithScores = await Promise.all(
          flexibleStaff.map(async (staff) => {
            const fairnessScore = await prisma.fairnessScore.findFirst({
              where: {
                staffId: staff.id,
                year: date.getFullYear(),
                month: date.getMonth() + 1
              }
            })

            let score = 0
            const doctorSchedule2 = slot.doctorSchedule as any
            const hasNightShift2 = doctorSchedule2?.night_shift || false

            if (dayTypes.includes('HOLIDAY')) {
              score = fairnessScore?.holidayCount || 0
            } else if (dayTypes.includes('HOLIDAY_ADJACENT')) {
              score = fairnessScore?.holidayAdjacentCount || 0
            } else if (dayTypes.includes('SATURDAY') || dayTypes.includes('SUNDAY')) {
              score = fairnessScore?.weekendCount || 0
            } else if (hasNightShift2) {
              score = fairnessScore?.nightShiftCount || 0
            }

            return { staff, score }
          })
        )

        flexWithScores.sort((a, b) => {
          // 점수가 같으면 우선순위로 정렬
          if (a.score === b.score) {
            return (b.staff.flexibilityPriority || 0) - (a.staff.flexibilityPriority || 0)
          }
          return a.score - b.score
        })

        const flexAssigned = flexWithScores.slice(0, shortfall).map(f => f.staff)
        assignments.push(...flexAssigned.map(s => ({ staffId: s.id, slotId })))

        if (flexAssigned.length < shortfall) {
          errors.push(`${category}: ${shortfall - flexAssigned.length}명 부족`)
        }
      }
    }

    // 6. DB에 저장
    for (const assignment of assignments) {
      await prisma.dailyStaffAssignment.create({
        data: {
          dailySlotId: assignment.slotId,
          staffId: assignment.staffId
        }
      })
    }

    return {
      success: errors.length === 0,
      assignments,
      errors
    }

  } catch (error) {
    console.error('Auto-assign error:', error)
    return {
      success: false,
      errors: ['Internal error: ' + (error as Error).message],
      assignments
    }
  }
}

export async function autoAssignWeeklySchedule(options: any) {
  // 주간 스케줄 자동 배치 로직
  // TODO: 추후 구현
  return { success: true, assignments: [], errors: [] }
}
