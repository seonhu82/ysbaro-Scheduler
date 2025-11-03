const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkWeek1Secondary() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 10

    // 10월 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month
      }
    })

    if (!schedule) {
      console.log('10월 스케줄을 찾을 수 없습니다.')
      return
    }

    console.log(`\n📋 10월 스케줄 ID: ${schedule.id}`)

    // 첫째 주: 2025-09-28 ~ 2025-10-04
    const week1Start = new Date('2025-09-28')
    const week1End = new Date('2025-10-04')

    console.log(`\n📅 첫째 주: ${week1Start.toISOString().split('T')[0]} ~ ${week1End.toISOString().split('T')[0]}`)

    // 진료실 직원 조회
    const treatmentStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      },
      orderBy: [
        { rank: 'asc' },
        { name: 'asc' }
      ]
    })

    console.log(`\n👥 진료실 직원 수: ${treatmentStaff.length}명`)

    // 각 직원별 첫째 주 근무 일수 확인
    console.log(`\n📊 첫째 주 근무 현황:`)

    const staffWorkDays = []

    for (const staff of treatmentStaff) {
      // 첫째 주의 모든 날짜에 대한 assignment 조회
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          staffId: staff.id,
          date: {
            gte: week1Start,
            lte: week1End
          }
        },
        orderBy: {
          date: 'asc'
        }
      })

      const workDays = assignments.filter(a => a.shiftType === 'DAY' || a.shiftType === 'NIGHT').length
      const offDays = assignments.filter(a => a.shiftType === 'OFF').length

      staffWorkDays.push({
        name: staff.name,
        workDays,
        offDays,
        total: assignments.length
      })

      console.log(`  ${staff.name}: 근무 ${workDays}일, OFF ${offDays}일 (총 ${assignments.length}일)`)

      // 상세 내역
      assignments.forEach(a => {
        const date = a.date.toISOString().split('T')[0]
        console.log(`    - ${date}: ${a.shiftType}`)
      })
    }

    // 주4일 미만인 직원 찾기
    console.log(`\n⚠️  주4일 미만 근무 직원:`)
    const under4Days = staffWorkDays.filter(s => s.workDays < 4)

    if (under4Days.length === 0) {
      console.log(`  없음 - 모든 직원이 주4일 이상 근무`)
    } else {
      under4Days.forEach(s => {
        console.log(`  ${s.name}: ${s.workDays}일 근무`)
      })
    }

    console.log(`\n📈 통계:`)
    console.log(`  - 총 ${treatmentStaff.length}명 중 ${under4Days.length}명이 주4일 미만`)
    console.log(`  - 평균 근무일: ${(staffWorkDays.reduce((sum, s) => sum + s.workDays, 0) / staffWorkDays.length).toFixed(2)}일`)

  } catch (error) {
    console.error('에러 발생:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWeek1Secondary()
