/**
 * 형평성 기반 연차/오프 신청 가능 일수 계산
 *
 * 핵심 개념:
 * - 편차가 양수(+) = 덜 일함 = 더 일해야 함 = 오프 신청 적게 가능
 * - 편차가 음수(-) = 많이 일함 = 덜 일해야 함 = 오프 신청 많이 가능
 * - 월 전체 기간 동안 편차를 0 근처로 조정하려면 신청 가능 일수에 제한 필요
 */

import { prisma } from '@/lib/prisma'

interface FairnessBasedLeaveLimit {
  maxAllowedDays: number      // 최대 신청 가능 일수 (형평성 고려)
  currentDeviation: number    // 현재 누적 편차
  avgDeviation: number        // 부서 평균 편차
  scoreDifference: number     // 내 편차 - 평균 편차
  workingDays: number         // 해당 월 총 근무일
  categoryWorkDays: number    // 내 구분이 일해야 하는 예상 일수
  recommendedOffDays: number  // 편차 조정 위한 권장 오프 일수
  reason: string              // 계산 근거 설명
}

/**
 * 형평성 기반 최대 신청 가능 일수 계산
 */
export async function calculateFairnessBasedLeaveLimit(
  clinicId: string,
  staffId: string,
  year: number,
  month: number
): Promise<FairnessBasedLeaveLimit> {
  // 1. 직원 정보 및 누적 편차 조회
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      name: true,
      categoryName: true,
      departmentName: true,
      fairnessScoreTotalDays: true,
      fairnessScoreNight: true,
      fairnessScoreWeekend: true,
      fairnessScoreHoliday: true,
      fairnessScoreHolidayAdjacent: true,
    }
  })

  if (!staff) {
    throw new Error('직원을 찾을 수 없습니다')
  }

  const currentDeviation = staff.fairnessScoreTotalDays || 0

  // 2. 같은 부서 직원들의 평균 편차 계산
  const departmentStaff = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true,
      departmentName: staff.departmentName,
    },
    select: {
      id: true,
      fairnessScoreTotalDays: true,
    }
  })

  let totalDeviation = 0
  let staffCount = 0
  for (const s of departmentStaff) {
    if (s.fairnessScoreTotalDays !== null) {
      totalDeviation += s.fairnessScoreTotalDays
      staffCount++
    }
  }

  const avgDeviation = staffCount > 0 ? totalDeviation / staffCount : 0
  const scoreDifference = currentDeviation - avgDeviation

  // 3. 정기 휴무일 설정 조회
  const closedDaySettings = await prisma.closedDaySettings.findUnique({
    where: { clinicId },
    select: { regularDays: true }
  })
  const regularClosedDays = (closedDaySettings?.regularDays as number[]) || [0] // 기본값: 일요일

  // 해당 월 총 근무일 계산
  let workingDays = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()
    // 정기 휴무일은 제외
    if (regularClosedDays.includes(dayOfWeek)) continue
    workingDays++
  }

  // 4. 구분별 비율 조회
  const ratioSettings = await prisma.categoryRatioSettings.findUnique({
    where: { clinicId },
    select: { ratios: true }
  })

  let categoryRatio = 0.25 // 기본값 25%
  if (ratioSettings && staff.categoryName) {
    const ratios = ratioSettings.ratios as { [key: string]: number }
    categoryRatio = (ratios[staff.categoryName] || 25) / 100
  }

  // 5. 내 구분이 일해야 하는 예상 일수
  // 전체 근무일 × 구분 비율
  const categoryWorkDays = Math.round(workingDays * categoryRatio)

  // 6. 편차 조정을 위한 최적 근무 일수 계산
  // 편차가 양수면 평균보다 많이 일해야 함
  // 편차가 음수면 평균보다 적게 일해야 함

  // 기본: 구분별 예상 근무일
  let targetWorkDays = categoryWorkDays

  // 편차 조정: 편차 2일당 1일 조정
  const fairnessAdjustment = Math.floor(scoreDifference / 2)
  targetWorkDays = targetWorkDays - fairnessAdjustment // 양수 편차면 더 일해야 함

  // 최소/최대 제한
  targetWorkDays = Math.max(Math.floor(categoryWorkDays * 0.5), targetWorkDays) // 최소 50%
  targetWorkDays = Math.min(Math.ceil(categoryWorkDays * 1.5), targetWorkDays)  // 최대 150%

  // 7. 권장 오프 일수 = 총 근무일 - 목표 근무일
  const recommendedOffDays = workingDays - targetWorkDays

  // 8. 이미 신청한 오프 확인
  const appliedOffs = await prisma.leaveApplication.count({
    where: {
      staffId,
      clinicId,
      status: 'CONFIRMED',
      leaveType: 'OFF',
      date: {
        gte: new Date(year, month - 1, 1),
        lte: new Date(year, month, 0),
      }
    }
  })

  // 9. 최대 신청 가능 일수 (기본 30% + 형평성 보너스)
  const baseAllowance = Math.floor(workingDays * 0.3)
  const fairnessBonus = Math.floor(scoreDifference / 2) // 양수면 음수 보너스 (덜 신청 가능)
  const maxAllowedDays = Math.max(0, baseAllowance + fairnessBonus - appliedOffs)

  // 10. 계산 근거 설명
  let reason = ''
  if (scoreDifference > 1) {
    reason = `누적 편차가 +${currentDeviation.toFixed(1)}일로 평균(${avgDeviation.toFixed(1)})보다 ${scoreDifference.toFixed(1)}일 적게 일했습니다. 형평성 조정을 위해 이번 달은 평균보다 많이 근무해야 하므로 오프 신청이 제한됩니다.`
  } else if (scoreDifference < -1) {
    reason = `누적 편차가 ${currentDeviation.toFixed(1)}일로 평균(${avgDeviation.toFixed(1)})보다 ${Math.abs(scoreDifference).toFixed(1)}일 많이 일했습니다. 형평성 조정을 위해 이번 달은 평균보다 적게 근무할 수 있어 오프 신청이 더 가능합니다.`
  } else {
    reason = `누적 편차가 ${currentDeviation.toFixed(1)}일로 평균(${avgDeviation.toFixed(1)})과 비슷합니다. 기본 신청 가능 일수(근무일의 30%)가 적용됩니다.`
  }

  return {
    maxAllowedDays,
    currentDeviation,
    avgDeviation,
    scoreDifference,
    workingDays,
    categoryWorkDays,
    recommendedOffDays,
    reason,
  }
}

/**
 * 특정 날짜 오프 신청 시 편차 영향 시뮬레이션
 */
export async function simulateFairnessImpact(
  clinicId: string,
  staffId: string,
  leaveDate: Date,
  currentSelections: string[] // 이미 선택한 날짜들
): Promise<{
  allowed: boolean
  newDeviation: number
  deviationChange: number
  message: string
}> {
  const year = leaveDate.getFullYear()
  const month = leaveDate.getMonth() + 1

  const limit = await calculateFairnessBasedLeaveLimit(clinicId, staffId, year, month)

  // 현재 선택 수 + 1 (새로 선택하려는 것)
  const totalSelections = currentSelections.length + 1

  if (totalSelections > limit.maxAllowedDays) {
    return {
      allowed: false,
      newDeviation: limit.currentDeviation + 1, // 1일 더 안 일하면 편차 +1
      deviationChange: 1,
      message: `형평성 기준 초과: 이번 달 최대 ${limit.maxAllowedDays}일까지만 오프 신청 가능합니다. (현재 ${currentSelections.length}일 선택 중)`,
    }
  }

  return {
    allowed: true,
    newDeviation: limit.currentDeviation,
    deviationChange: 0,
    message: '신청 가능합니다',
  }
}
