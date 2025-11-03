/**
 * 첫째주 직원별 근무일수 확인
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function checkWeek1Detail() {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { year: 2025, month: 10 }
    })

    if (!schedule) {
      console.log('❌ 스케줄 없음')
      return
    }

    // 첫째주: 2025-09-28 (일) ~ 2025-10-04 (토)
    const weekStart = new Date('2025-09-28T00:00:00.000Z')
    const weekEnd = new Date('2025-10-04T23:59:59.999Z')

    // 진료실 직원 목록
    const staff = await prisma.staff.findMany({
      where: {
        clinicId: schedule.clinicId,
        departmentName: '진료실',
        isActive: true
      },
      orderBy: { name: 'asc' }
    })

    console.log('\n👥 진료실 직원별 첫째주 근무 현황 (2025-09-28 ~ 2025-10-04):\n')

    for (const s of staff) {
      // 첫째주 배정 조회
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          staffId: s.id,
          date: {
            gte: weekStart,
            lte: weekEnd
          }
        },
        orderBy: { date: 'asc' }
      })

      // 확정 연차 조회
      const annualLeaves = await prisma.leaveApplication.findMany({
        where: {
          staffId: s.id,
          leaveType: 'ANNUAL',
          status: 'CONFIRMED',
          date: {
            gte: weekStart,
            lte: weekEnd
          }
        }
      })

      const workDays = assignments.filter(a => a.shiftType !== 'OFF')
      const offDays = assignments.filter(a => a.shiftType === 'OFF')

      // 근무일수 계산 (연차 포함)
      const totalWorkDays = workDays.length + annualLeaves.length

      console.log(`${s.name} (${s.categoryName}):`)
      console.log(`  총 근무일: ${totalWorkDays}일 (실제 근무 ${workDays.length}일 + 연차 ${annualLeaves.length}일)`)

      if (workDays.length > 0) {
        console.log(`  근무일: ${workDays.map(a => `${toDateKey(a.date)}(${a.shiftType})`).join(', ')}`)
      }
      if (annualLeaves.length > 0) {
        console.log(`  연차: ${annualLeaves.map(l => toDateKey(l.date)).join(', ')}`)
      }
      if (offDays.length > 0) {
        console.log(`  OFF: ${offDays.map(a => toDateKey(a.date)).join(', ')}`)
      }

      if (totalWorkDays > 4) {
        console.log(`  ⚠️  주4일 초과! (${totalWorkDays}일)`)
      } else if (totalWorkDays < 4) {
        console.log(`  ⚠️  주4일 미달! (${totalWorkDays}일)`)
      }

      console.log('')
    }

    // 문제 날짜 상세 분석
    console.log('\n🔍 문제 날짜 상세 분석:\n')

    const problemDates = ['2025-10-02', '2025-10-03']

    for (const dateStr of problemDates) {
      const date = new Date(dateStr + 'T00:00:00.000Z')

      console.log(`${dateStr}:`)

      // 원장 스케줄
      const doctors = await prisma.scheduleDoctor.findMany({
        where: {
          scheduleId: schedule.id,
          date: date
        },
        include: {
          doctor: true
        }
      })

      console.log(`  원장: ${doctors.map(d => d.doctor.shortName).join(', ')} (${doctors.some(d => d.hasNightShift) ? '야간' : '일반'})`)

      // 직원 배정
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          date: date
        },
        include: {
          staff: true
        }
      })

      const working = assignments.filter(a => a.shiftType !== 'OFF')
      const off = assignments.filter(a => a.shiftType === 'OFF')

      console.log(`  배정: 근무 ${working.length}명, OFF ${off.length}명`)

      if (working.length > 0) {
        console.log(`  근무자: ${working.map(a => a.staff.name).join(', ')}`)
      }

      // 이 날짜에 주4일 제한으로 배정 불가능했던 직원 찾기
      console.log(`\n  주4일 제한으로 배정 불가능했던 직원:`)

      for (const s of staff) {
        // 이 날짜 이전까지의 근무일 계산
        const beforeDate = new Date(date)
        beforeDate.setHours(0, 0, 0, -1) // 전날까지

        const beforeAssignments = await prisma.staffAssignment.findMany({
          where: {
            scheduleId: schedule.id,
            staffId: s.id,
            date: {
              gte: weekStart,
              lte: beforeDate
            },
            shiftType: { not: 'OFF' }
          }
        })

        const beforeAnnual = await prisma.leaveApplication.findMany({
          where: {
            staffId: s.id,
            leaveType: 'ANNUAL',
            status: 'CONFIRMED',
            date: {
              gte: weekStart,
              lte: beforeDate
            }
          }
        })

        const workDaysBefore = beforeAssignments.length + beforeAnnual.length

        if (workDaysBefore >= 4) {
          console.log(`    - ${s.name}: 이미 ${workDaysBefore}일 근무 (주4일 도달)`)
        }
      }

      console.log('')
    }

  } catch (error) {
    console.error('❌ 에러:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWeek1Detail()
