/**
 * 배정 완료 후 형평성 스냅샷 생성
 *
 * 실시간 편차는 배정 중 baseline이 변해서 일관성이 없음
 * 배정 완료 후 최종 결과를 기반으로 편차를 재계산하여 저장
 * 다음 달 배정 시 이 스냅샷을 기준으로 시작
 */

import { prisma } from '@/lib/prisma'

interface StaffFairnessSnapshot {
  staffId: string
  staffName: string
  departmentName: string
  categoryName: string | null
  actual: {
    total: number
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
  }
  deviation: {
    total: number
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
  }
  cumulativeActual: {
    total: number
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
  }
  cumulativeDeviation: number
  cumulativeDeviationDetails: {
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
  }
}

/**
 * 배정 완료 후 최종 형평성 재계산 & 저장
 *
 * @param scheduleId - 스케줄 ID
 * @param clinicId - 클리닉 ID
 * @param year - 연도
 * @param month - 월
 */
export async function recalculateFinalFairness(
  scheduleId: string,
  clinicId: string,
  year: number,
  month: number
): Promise<void> {
  console.log(`\n========== 형평성 스냅샷 생성 시작 (${year}년 ${month}월) ==========`)

  // 1. 스케줄 정보 조회
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      doctors: {
        include: { doctor: true }
      }
    }
  })

  if (!schedule) {
    throw new Error(`Schedule not found: ${scheduleId}`)
  }

  // 2. 실제 배치 날짜 범위 조회
  const dateRange = await prisma.staffAssignment.aggregate({
    where: { scheduleId },
    _min: { date: true },
    _max: { date: true }
  })

  const startDate = dateRange._min.date || new Date(year, month - 1, 1)
  const endDate = dateRange._max.date || new Date(year, month, 0)

  console.log(`   📅 배치 범위: ${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`)

  // 3. 공휴일 정보 조회
  const holidays = await prisma.holiday.findMany({
    where: {
      clinicId,
      date: { gte: startDate, lte: endDate }
    }
  })

  const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))

  // 4. 모든 활성 직원 조회
  const allStaff = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      departmentName: true,
      categoryName: true
    }
  })

  console.log(`   👥 대상 직원: ${allStaff.length}명`)

  // 5. 부서별로 그룹화
  const staffByDepartment = new Map<string, typeof allStaff>()
  for (const staff of allStaff) {
    const dept = staff.departmentName || '미지정'
    if (!staffByDepartment.has(dept)) {
      staffByDepartment.set(dept, [])
    }
    staffByDepartment.get(dept)!.push(staff)
  }

  console.log(`   🏢 부서: ${Array.from(staffByDepartment.keys()).join(', ')}\n`)

  // 6. 이전 달들의 누적 데이터 로드
  const previousCumulative = month > 1 ? await loadCumulativeFairness(clinicId, year, month) : {}

  // 7. 부서별로 처리
  const allSnapshots: Record<string, StaffFairnessSnapshot> = {}

  for (const [deptName, deptStaff] of staffByDepartment) {
    console.log(`\n   📊 ${deptName} 부서 처리 (${deptStaff.length}명):`)

    // 6-1. 부서 전체 실제 근무일 합계 계산
    const deptTotals = {
      total: 0,
      night: 0,
      weekend: 0,
      holiday: 0,
      holidayAdjacent: 0
    }

    // 6-2. 각 직원의 실제 근무일 계산
    const staffActuals: Array<{
      staff: typeof deptStaff[0]
      actual: typeof deptTotals
    }> = []

    for (const staff of deptStaff) {
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId,
          staffId: staff.id,
          date: { gte: startDate, lte: endDate },
          shiftType: { not: 'OFF' }
        },
        select: {
          date: true,
          shiftType: true
        }
      })

      const actual = {
        total: assignments.length,
        night: 0,
        weekend: 0,
        holiday: 0,
        holidayAdjacent: 0
      }

      for (const assignment of assignments) {
        const dateKey = assignment.date.toISOString().split('T')[0]
        const dayOfWeek = assignment.date.getDay()
        const isWeekend = dayOfWeek === 6 // 토요일
        const isHoliday = holidayDates.has(dateKey)

        // 야간
        if (assignment.shiftType === 'NIGHT') {
          actual.night++
        }

        // 주말
        if (isWeekend) {
          actual.weekend++
        }

        // 공휴일
        if (isHoliday) {
          actual.holiday++
        }

        // 공휴일 인접일
        if (!isHoliday) {
          const yesterday = new Date(assignment.date)
          yesterday.setDate(yesterday.getDate() - 1)
          const tomorrow = new Date(assignment.date)
          tomorrow.setDate(tomorrow.getDate() + 1)

          if (
            holidayDates.has(yesterday.toISOString().split('T')[0]) ||
            holidayDates.has(tomorrow.toISOString().split('T')[0])
          ) {
            actual.holidayAdjacent++
          }
        }
      }

      staffActuals.push({ staff, actual })

      // 부서 합계에 추가
      deptTotals.total += actual.total
      deptTotals.night += actual.night
      deptTotals.weekend += actual.weekend
      deptTotals.holiday += actual.holiday
      deptTotals.holidayAdjacent += actual.holidayAdjacent
    }

    // 6-3. 부서 평균 계산
    const staffCount = deptStaff.length
    const deptAverage = {
      total: staffCount > 0 ? deptTotals.total / staffCount : 0,
      night: staffCount > 0 ? deptTotals.night / staffCount : 0,
      weekend: staffCount > 0 ? deptTotals.weekend / staffCount : 0,
      holiday: staffCount > 0 ? deptTotals.holiday / staffCount : 0,
      holidayAdjacent: staffCount > 0 ? deptTotals.holidayAdjacent / staffCount : 0
    }

    console.log(`      부서 평균: 총 ${deptAverage.total.toFixed(1)}일, 야간 ${deptAverage.night.toFixed(1)}일, 주말 ${deptAverage.weekend.toFixed(1)}일`)

    // 6-4. 각 직원의 편차 계산 (평균 - 실제)
    for (const { staff, actual } of staffActuals) {
      const deviation = {
        total: deptAverage.total - actual.total,
        night: deptAverage.night - actual.night,
        weekend: deptAverage.weekend - actual.weekend,
        holiday: deptAverage.holiday - actual.holiday,
        holidayAdjacent: deptAverage.holidayAdjacent - actual.holidayAdjacent
      }

      // 소수점 1자리로 반올림
      const roundedDeviation = {
        total: Math.round(deviation.total * 10) / 10,
        night: Math.round(deviation.night * 10) / 10,
        weekend: Math.round(deviation.weekend * 10) / 10,
        holiday: Math.round(deviation.holiday * 10) / 10,
        holidayAdjacent: Math.round(deviation.holidayAdjacent * 10) / 10
      }

      // 누적 실제 근무일 계산
      const previousData = previousCumulative[staff.id]
      const cumulativeActual = {
        total: (previousData?.actual.total || 0) + actual.total,
        night: (previousData?.actual.night || 0) + actual.night,
        weekend: (previousData?.actual.weekend || 0) + actual.weekend,
        holiday: (previousData?.actual.holiday || 0) + actual.holiday,
        holidayAdjacent: (previousData?.actual.holidayAdjacent || 0) + actual.holidayAdjacent
      }

      // 누적 편차 계산
      const cumulativeDeviationTotal = Math.round(((previousData?.deviation.total || 0) + roundedDeviation.total) * 10) / 10
      const cumulativeDeviationDetails = {
        night: Math.round(((previousData?.deviation.night || 0) + roundedDeviation.night) * 10) / 10,
        weekend: Math.round(((previousData?.deviation.weekend || 0) + roundedDeviation.weekend) * 10) / 10,
        holiday: Math.round(((previousData?.deviation.holiday || 0) + roundedDeviation.holiday) * 10) / 10,
        holidayAdjacent: Math.round(((previousData?.deviation.holidayAdjacent || 0) + roundedDeviation.holidayAdjacent) * 10) / 10
      }

      allSnapshots[staff.id] = {
        staffId: staff.id,
        staffName: staff.name || '직원',
        departmentName: staff.departmentName || '미지정',
        categoryName: staff.categoryName,
        actual,
        deviation: roundedDeviation,
        cumulativeActual,
        cumulativeDeviation: cumulativeDeviationTotal,
        cumulativeDeviationDetails
      }

      console.log(`         ${staff.name}: 총 ${actual.total}일 (편차 ${roundedDeviation.total}) / 누적 ${cumulativeActual.total}일 (누적 편차 ${cumulativeDeviationTotal})`)
    }
  }

  // 7. Schedule.monthlyFairness에 저장
  await prisma.schedule.update({
    where: { id: scheduleId },
    data: {
      monthlyFairness: allSnapshots as any
    }
  })

  console.log(`\n   ✅ 스냅샷 저장 완료: ${Object.keys(allSnapshots).length}명`)

  // 8. Staff 테이블에도 저장 (최신 편차)
  for (const snapshot of Object.values(allSnapshots)) {
    await prisma.staff.update({
      where: { id: snapshot.staffId },
      data: {
        fairnessScoreTotalDays: snapshot.deviation.total,
        fairnessScoreNight: snapshot.deviation.night,
        fairnessScoreWeekend: snapshot.deviation.weekend,
        fairnessScoreHoliday: snapshot.deviation.holiday,
        fairnessScoreHolidayAdjacent: snapshot.deviation.holidayAdjacent
      }
    })
  }

  console.log(`   ✅ Staff 테이블 업데이트 완료`)
  console.log(`========== 형평성 스냅샷 생성 완료 ==========\n`)
}

/**
 * 이전 달들의 누적 형평성 로드
 *
 * @param clinicId - 클리닉 ID
 * @param year - 연도
 * @param month - 월 (이 달 이전까지의 누적)
 * @returns 직원별 누적 편차
 */
export async function loadCumulativeFairness(
  clinicId: string,
  year: number,
  month: number
): Promise<Record<string, {
  actual: {
    total: number
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
  }
  deviation: {
    total: number
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
  }
}>> {
  console.log(`\n📦 누적 형평성 로드 (${year}년 1월 ~ ${month - 1}월)`)

  // 1월부터 이전 달까지 조회
  const previousSchedules = await prisma.schedule.findMany({
    where: {
      clinicId,
      year,
      month: { gte: 1, lt: month }
    },
    select: {
      month: true,
      monthlyFairness: true
    },
    orderBy: { month: 'asc' }
  })

  const cumulativeData: Record<string, {
    actual: {
      total: number
      night: number
      weekend: number
      holiday: number
      holidayAdjacent: number
    }
    deviation: {
      total: number
      night: number
      weekend: number
      holiday: number
      holidayAdjacent: number
    }
  }> = {}

  for (const schedule of previousSchedules) {
    if (!schedule.monthlyFairness) continue

    const fairness = schedule.monthlyFairness as any

    for (const [staffId, snapshot] of Object.entries(fairness)) {
      const data = snapshot as any

      if (!cumulativeData[staffId]) {
        cumulativeData[staffId] = {
          actual: {
            total: 0,
            night: 0,
            weekend: 0,
            holiday: 0,
            holidayAdjacent: 0
          },
          deviation: {
            total: 0,
            night: 0,
            weekend: 0,
            holiday: 0,
            holidayAdjacent: 0
          }
        }
      }

      // 실제 근무일 누적
      cumulativeData[staffId].actual.total += data.actual?.total || 0
      cumulativeData[staffId].actual.night += data.actual?.night || 0
      cumulativeData[staffId].actual.weekend += data.actual?.weekend || 0
      cumulativeData[staffId].actual.holiday += data.actual?.holiday || 0
      cumulativeData[staffId].actual.holidayAdjacent += data.actual?.holidayAdjacent || 0

      // 편차 누적
      cumulativeData[staffId].deviation.total += data.deviation?.total || 0
      cumulativeData[staffId].deviation.night += data.deviation?.night || 0
      cumulativeData[staffId].deviation.weekend += data.deviation?.weekend || 0
      cumulativeData[staffId].deviation.holiday += data.deviation?.holiday || 0
      cumulativeData[staffId].deviation.holidayAdjacent += data.deviation?.holidayAdjacent || 0
    }
  }

  console.log(`   ✅ 누적 데이터 로드 완료: ${Object.keys(cumulativeData).length}명\n`)

  return cumulativeData
}
