/**
 * 형평성 점수 업데이트 서비스
 *
 * 주간 배치 완료 후 각 직원의 형평성 점수를 업데이트합니다.
 * - 야간 근무 횟수
 * - 주말 근무 횟수
 * - 공휴일 근무 횟수
 * - 공휴일 전후 근무 횟수
 */

import { prisma } from '@/lib/prisma'
import { classifyDayType } from '@/lib/utils/day-type-classifier'

/**
 * 주간 배치 완료 후 형평성 점수 업데이트
 *
 * @param weekInfoId - 주차 정보 ID
 */
export async function updateFairnessScoresAfterAssignment(
  weekInfoId: string
): Promise<void> {
  console.log('\n📊 형평성 점수 업데이트 시작...')

  // WeekInfo 로드
  const weekInfo = await prisma.weekInfo.findUnique({
    where: { id: weekInfoId }
  })

  if (!weekInfo) {
    throw new Error('WeekInfo를 찾을 수 없습니다')
  }

  const { clinicId, year, month } = weekInfo

  // DailySlots 및 배치 정보 로드
  const dailySlots = await prisma.dailySlot.findMany({
    where: {
      week: { id: weekInfoId }
    },
    include: {
      staffAssignments: {
        include: {
          staff: true
        }
      }
    }
  })

  // 형평성 설정 로드
  const fairnessSettings = await prisma.fairnessSettings.findUnique({
    where: { clinicId }
  })

  // 직원별 점수 증가분 집계
  const staffScoreIncrements = new Map<
    string,
    {
      nightShift: number
      weekend: number
      holiday: number
      holidayAdjacent: number
    }
  >()

  // 각 날짜별로 처리
  for (const slot of dailySlots) {
    const dayTypes = await classifyDayType(clinicId, slot.date)
    const doctorSchedule = slot.doctorSchedule as any
    const hasNightShift = doctorSchedule?.night_shift === true

    // 이 날짜에 배치된 직원들
    for (const assignment of slot.staffAssignments) {
      const staffId = assignment.staffId

      // 직원별 증가분 초기화
      if (!staffScoreIncrements.has(staffId)) {
        staffScoreIncrements.set(staffId, {
          nightShift: 0,
          weekend: 0,
          holiday: 0,
          holidayAdjacent: 0
        })
      }

      const increments = staffScoreIncrements.get(staffId)!

      // 야간 근무
      if (hasNightShift && fairnessSettings?.enableNightShiftFairness) {
        increments.nightShift++
      }

      // 주말 근무
      if (
        (dayTypes.includes('SATURDAY') || dayTypes.includes('SUNDAY')) &&
        fairnessSettings?.enableWeekendFairness
      ) {
        increments.weekend++
      }

      // 공휴일 근무
      if (dayTypes.includes('HOLIDAY') && fairnessSettings?.enableHolidayFairness) {
        increments.holiday++
      }

      // 공휴일 전후 근무
      if (
        (dayTypes.includes('HOLIDAY_ADJACENT') || dayTypes.includes('HOLIDAY_ADJACENT_SUNDAY')) &&
        fairnessSettings?.enableHolidayAdjacentFairness
      ) {
        increments.holidayAdjacent++
      }
    }
  }

  console.log(`   → ${staffScoreIncrements.size}명의 직원 점수 업데이트`)

  // 트랜잭션으로 점수 업데이트
  await prisma.$transaction(async (tx) => {
    for (const [staffId, increments] of staffScoreIncrements.entries()) {
      // 해당 연도/월의 형평성 점수 조회 또는 생성
      const existingScore = await tx.fairnessScore.findUnique({
        where: {
          staffId_year_month: {
            staffId,
            year,
            month
          }
        },
        include: {
          staff: {
            select: { name: true }
          }
        }
      })

      if (existingScore) {
        // 기존 점수 업데이트
        await tx.fairnessScore.update({
          where: { id: existingScore.id },
          data: {
            nightShiftCount: {
              increment: increments.nightShift
            },
            weekendCount: {
              increment: increments.weekend
            },
            holidayCount: {
              increment: increments.holiday
            },
            holidayAdjacentCount: {
              increment: increments.holidayAdjacent
            }
          }
        })

        console.log(
          `   ✅ ${existingScore.staff.name}: ` +
            `야간 +${increments.nightShift}, ` +
            `주말 +${increments.weekend}, ` +
            `공휴일 +${increments.holiday}, ` +
            `공휴일전후 +${increments.holidayAdjacent}`
        )
      } else {
        // 신규 점수 생성
        const staff = await tx.staff.findUnique({
          where: { id: staffId },
          select: { name: true }
        })

        await tx.fairnessScore.create({
          data: {
            staffId,
            year,
            month,
            nightShiftCount: increments.nightShift,
            weekendCount: increments.weekend,
            holidayCount: increments.holiday,
            holidayAdjacentCount: increments.holidayAdjacent
          }
        })

        console.log(
          `   ✨ 신규 점수 생성 (${staff?.name || staffId}): ` +
            `야간 ${increments.nightShift}, ` +
            `주말 ${increments.weekend}, ` +
            `공휴일 ${increments.holiday}, ` +
            `공휴일전후 ${increments.holidayAdjacent}`
        )
      }
    }
  })

  console.log('✅ 형평성 점수 업데이트 완료\n')
}

/**
 * 월별 형평성 조정 적용
 *
 * 익월 배치 시 전월의 형평성 조정 사항을 반영합니다.
 *
 * @param clinicId - 병원 ID
 * @param year - 연도
 * @param month - 월 (1-12)
 */
export async function applyMonthlyFairnessAdjustments(
  clinicId: string,
  year: number,
  month: number
): Promise<{
  appliedCount: number
  adjustments: Array<{ staffName: string; adjustment: string }>
}> {
  console.log(`\n⚖️ 월별 형평성 조정 적용: ${year}년 ${month}월`)

  // 해당 월의 미적용 조정 사항 조회
  const pendingAdjustments = await prisma.fairnessAdjustment.findMany({
    where: {
      staff: { clinicId },
      year,
      month,
      status: 'PENDING'
    },
    include: {
      staff: {
        select: { name: true }
      }
    }
  })

  if (pendingAdjustments.length === 0) {
    console.log('   → 적용할 조정 사항 없음')
    return { appliedCount: 0, adjustments: [] }
  }

  const results: Array<{ staffName: string; adjustment: string }> = []

  // 각 조정 사항 적용
  for (const adjustment of pendingAdjustments) {
    // 여기서는 조정 사항을 기록만 하고,
    // 실제 배치 시 우선순위 조정은 배치 알고리즘에서 처리
    await prisma.fairnessAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: 'APPLIED',
        appliedAt: new Date()
      }
    })

    const adjustmentText =
      adjustment.adjustmentType === 'INCREASE'
        ? `${adjustment.adjustmentDays}일 더 배치`
        : `${adjustment.adjustmentDays}일 덜 배치`

    results.push({
      staffName: adjustment.staff.name,
      adjustment: adjustmentText
    })

    console.log(`   ✅ ${adjustment.staff.name}: ${adjustmentText}`)
  }

  console.log(`✅ 총 ${results.length}건의 조정 사항 적용 완료\n`)

  return {
    appliedCount: results.length,
    adjustments: results
  }
}
