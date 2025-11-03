const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkWeeklyTotals() {
  try {
    const scheduleId = 'cmhgmfchh02zp12wjh3abc4ku'
    const clinicId = 'cmh697itv0001fw83azbrqe60'

    // 진료실 직원 조회
    const treatmentStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      }
    })

    console.log(`\n진료실 직원: ${treatmentStaff.length}명`)

    // 주차별 확인
    const weeks = [
      { name: 'Week 1', start: new Date('2025-09-28'), end: new Date('2025-10-04') },
      { name: 'Week 2', start: new Date('2025-10-05'), end: new Date('2025-10-11') },
      { name: 'Week 3', start: new Date('2025-10-12'), end: new Date('2025-10-18') },
      { name: 'Week 4', start: new Date('2025-10-19'), end: new Date('2025-10-25') },
      { name: 'Week 5', start: new Date('2025-10-26'), end: new Date('2025-11-01') }
    ]

    for (const week of weeks) {
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId,
          date: {
            gte: week.start,
            lte: week.end
          }
        }
      })

      const workCount = assignments.filter(a => a.shiftType === 'DAY' || a.shiftType === 'NIGHT').length
      const offCount = assignments.filter(a => a.shiftType === 'OFF').length
      const annualCount = assignments.filter(a => a.shiftType === 'ANNUAL').length

      const total = workCount + offCount + annualCount

      console.log(`\n${week.name} (${week.start.toISOString().split('T')[0]} ~ ${week.end.toISOString().split('T')[0]}):`)
      console.log(`  근무: ${workCount}일`)
      console.log(`  OFF: ${offCount}일`)
      console.log(`  연차: ${annualCount}일`)
      console.log(`  총합: ${total}일 ${total === treatmentStaff.length * 7 ? '✅' : `❌ (예상: ${treatmentStaff.length * 7})`}`)
    }

  } catch (error) {
    console.error('에러:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWeeklyTotals()
