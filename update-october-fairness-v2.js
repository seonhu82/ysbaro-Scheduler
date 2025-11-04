const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updateOctoberFairness() {
  try {
    console.log('\n🔧 10월 형평성 점수 업데이트 시작...\n')

    // 주의: 10월이 첫 달이므로 리셋하지만,
    // 실제 배포 시에는 기존 점수에 더해야 함!
    console.log('📌 10월이 첫 달이므로 기존 점수 리셋 (일회성)')
    await prisma.staff.updateMany({
      where: {
        departmentName: '진료실',
        isActive: true
      },
      data: {
        fairnessScoreTotalDays: 0,
        fairnessScoreNight: 0,
        fairnessScoreWeekend: 0,
        fairnessScoreHoliday: 0,
        fairnessScoreHolidayAdjacent: 0
      }
    })
    console.log('✅ 리셋 완료 (실제 배포 시에는 누적됨)\n')

    // 10월 배포된 스케줄 찾기
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10,
        status: 'DEPLOYED'
      }
    })

    if (!schedule) {
      console.log('❌ 10월 배포된 스케줄을 찾을 수 없습니다')
      return
    }

    console.log(`✅ 10월 스케줄 찾음: ${schedule.id}`)
    const { clinicId, year, month } = schedule

    // staff-stats API 호출하여 형평성 점수 가져오기
    console.log('📊 직원별 통계 API 호출 중...\n')

    const response = await fetch(`http://localhost:3000/api/schedule/staff-stats?year=${year}&month=${month}&status=DEPLOYED`, {
      headers: {
        'Cookie': 'authjs.session-token=your-admin-token' // 실제로는 인증 필요 없이 직접 DB 조회
      }
    })

    // API 대신 직접 계산 (staff-stats 로직 복사)
    const allTreatmentStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      },
      select: {
        id: true,
        name: true
      }
    })

    console.log(`   → ${allTreatmentStaff.length}명의 진료실 직원\n`)

    // 직원별 배치 조회
    const staffAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staff: {
          departmentName: '진료실',
          isActive: true
        }
      },
      include: {
        staff: true
      }
    })

    // 공휴일 조회
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: { gte: startDate, lte: endDate }
      }
    })
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]))

    // 직원별 실제 근무일 집계
    const staffActual = new Map()
    for (const staff of allTreatmentStaff) {
      staffActual.set(staff.id, {
        name: staff.name,
        totalDays: 0,
        nightShiftCount: 0,
        weekendCount: 0,
        holidayCount: 0,
        holidayAdjacentCount: 0
      })
    }

    for (const assignment of staffAssignments) {
      if (assignment.shiftType === 'OFF') continue

      const stats = staffActual.get(assignment.staffId)
      if (!stats) continue

      const assignmentDate = new Date(assignment.date)
      const dateKey = assignmentDate.toISOString().split('T')[0]
      const dayOfWeek = assignmentDate.getDay()

      if (assignmentDate < startDate || assignmentDate > endDate) continue

      stats.totalDays++

      if (assignment.shiftType === 'NIGHT') {
        stats.nightShiftCount++
      }

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        stats.weekendCount++
      }

      if (holidayDates.has(dateKey)) {
        stats.holidayCount++
      }

      const prevDay = new Date(assignmentDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const nextDay = new Date(assignmentDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      if ((holidayDates.has(prevDay) || holidayDates.has(nextDay)) && !holidayDates.has(dateKey)) {
        stats.holidayAdjacentCount++
      }
    }

    // 기준 계산 (평균)
    const totalDaysSum = Array.from(staffActual.values()).reduce((sum, s) => sum + s.totalDays, 0)
    const totalNightSum = Array.from(staffActual.values()).reduce((sum, s) => sum + s.nightShiftCount, 0)
    const totalWeekendSum = Array.from(staffActual.values()).reduce((sum, s) => sum + s.weekendCount, 0)
    const totalHolidaySum = Array.from(staffActual.values()).reduce((sum, s) => sum + s.holidayCount, 0)
    const totalHolidayAdjacentSum = Array.from(staffActual.values()).reduce((sum, s) => sum + s.holidayAdjacentCount, 0)

    const baseline = {
      totalDays: allTreatmentStaff.length > 0 ? totalDaysSum / allTreatmentStaff.length : 0,
      nightShift: allTreatmentStaff.length > 0 ? totalNightSum / allTreatmentStaff.length : 0,
      weekend: allTreatmentStaff.length > 0 ? totalWeekendSum / allTreatmentStaff.length : 0,
      holiday: allTreatmentStaff.length > 0 ? totalHolidaySum / allTreatmentStaff.length : 0,
      holidayAdjacent: allTreatmentStaff.length > 0 ? totalHolidayAdjacentSum / allTreatmentStaff.length : 0
    }

    console.log('📊 기준 계산 완료:')
    console.log(`   총근무일 기준: ${baseline.totalDays.toFixed(2)}`)
    console.log(`   야간 기준: ${baseline.nightShift.toFixed(2)}`)
    console.log(`   주말 기준: ${baseline.weekend.toFixed(2)}\n`)

    // 편차 계산 및 저장
    let updatedCount = 0
    for (const [staffId, actual] of staffActual.entries()) {
      const deviation = {
        totalDays: baseline.totalDays - actual.totalDays,
        nightShift: baseline.nightShift - actual.nightShiftCount,
        weekend: baseline.weekend - actual.weekendCount,
        holiday: baseline.holiday - actual.holidayCount,
        holidayAdjacent: baseline.holidayAdjacent - actual.holidayAdjacentCount
      }

      await prisma.staff.update({
        where: { id: staffId },
        data: {
          fairnessScoreTotalDays: deviation.totalDays,
          fairnessScoreNight: deviation.nightShift,
          fairnessScoreWeekend: deviation.weekend,
          fairnessScoreHoliday: deviation.holiday,
          fairnessScoreHolidayAdjacent: deviation.holidayAdjacent
        }
      })

      console.log(
        `   ✅ ${actual.name}: ` +
          `총근무편차=${deviation.totalDays > 0 ? '+' : ''}${deviation.totalDays.toFixed(1)}, ` +
          `야간=${deviation.nightShift > 0 ? '+' : ''}${deviation.nightShift.toFixed(1)}, ` +
          `주말=${deviation.weekend > 0 ? '+' : ''}${deviation.weekend.toFixed(1)}`
      )

      // FairnessScore 테이블에도 저장
      await prisma.fairnessScore.upsert({
        where: {
          staffId_year_month: {
            staffId,
            year,
            month
          }
        },
        create: {
          staffId,
          year,
          month,
          nightShiftCount: actual.nightShiftCount,
          weekendCount: actual.weekendCount,
          holidayCount: actual.holidayCount,
          holidayAdjacentCount: actual.holidayAdjacentCount
        },
        update: {
          nightShiftCount: actual.nightShiftCount,
          weekendCount: actual.weekendCount,
          holidayCount: actual.holidayCount,
          holidayAdjacentCount: actual.holidayAdjacentCount
        }
      })

      updatedCount++
    }

    console.log(`\n✅ 10월 형평성 점수 업데이트 완료!`)
    console.log(`   총 ${updatedCount}명의 직원 편차 점수 업데이트 완료\n`)

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateOctoberFairness()
