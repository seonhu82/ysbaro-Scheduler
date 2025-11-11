const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testOffAnnualSplit() {
  try {
    const token = '34e9f4f17bc6fcc3ff0641b453fd9b85'
    const startDate = new Date('2025-11-02T00:00:00.000Z')
    const endDate = new Date('2025-11-29T00:00:00.000Z')

    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token }
    })

    const clinicId = link.clinicId

    // 규칙 설정
    const ruleSettings = await prisma.ruleSettings.findUnique({
      where: { clinicId },
      select: {
        weekBusinessDays: true,
        defaultWorkDays: true
      }
    })

    const weekBusinessDays = ruleSettings?.weekBusinessDays || 6
    const defaultWorkDays = ruleSettings?.defaultWorkDays || 4

    console.log('📋 규칙 설정:')
    console.log('  주 영업일:', weekBusinessDays)
    console.log('  주 근무일:', defaultWorkDays)
    console.log('  주당 OFF일:', weekBusinessDays - defaultWorkDays)

    // 총 직원 수
    const totalStaffCount = await prisma.staff.count({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      }
    })
    console.log('  총 직원 수:', totalStaffCount)

    // 주 계산
    function getWeekStart(date) {
      const d = new Date(date)
      const day = d.getUTCDay()
      const diff = day // 일요일이 0
      d.setUTCDate(d.getUTCDate() - diff)
      d.setUTCHours(0, 0, 0, 0)
      return d
    }

    const weekStarts = new Set()
    let current = new Date(startDate)
    while (current <= endDate) {
      const weekStart = getWeekStart(current)
      weekStarts.add(weekStart.toISOString())
      current.setUTCDate(current.getUTCDate() + 1)
    }

    const weekCount = weekStarts.size
    console.log('  총 주 수:', weekCount)
    console.log('  주 목록:', Array.from(weekStarts).map(w => w.split('T')[0]))

    // OFF 슬롯 계산
    const totalOffSlots = weekCount * totalStaffCount * (weekBusinessDays - defaultWorkDays)
    console.log('\n📊 OFF 슬롯 계산:')
    console.log('  ' + weekCount + '주 × ' + totalStaffCount + '명 × ' + (weekBusinessDays - defaultWorkDays) + '일 = ' + totalOffSlots)

    // 전체 슬롯 (앞서 계산한 227)
    const totalSlots = 227
    const totalAnnualSlots = totalSlots - totalOffSlots

    console.log('\n📊 최종 슬롯 분배:')
    console.log('  전체 슬롯:', totalSlots)
    console.log('  OFF 슬롯:', totalOffSlots)
    console.log('  연차 슬롯:', totalAnnualSlots)

    // 이미 신청된 것 확인
    const applications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        linkId: link.id,
        date: {
          gte: startDate,
          lte: endDate
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      },
      select: {
        leaveType: true
      }
    })

    const appliedOffCount = applications.filter(a => a.leaveType === 'OFF').length
    const appliedAnnualCount = applications.filter(a => a.leaveType === 'ANNUAL').length

    console.log('\n📊 신청 현황:')
    console.log('  신청된 OFF:', appliedOffCount)
    console.log('  신청된 연차:', appliedAnnualCount)
    console.log('  신청 가능 OFF:', totalOffSlots - appliedOffCount)
    console.log('  신청 가능 연차:', totalAnnualSlots - appliedAnnualCount)

  } catch (error) {
    console.error('❌ 에러:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testOffAnnualSplit()
