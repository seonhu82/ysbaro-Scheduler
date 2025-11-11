const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testSlotCalculation() {
  try {
    const token = '34e9f4f17bc6fcc3ff0641b453fd9b85'
    const startDate = new Date('2025-11-02T00:00:00.000Z')
    const endDate = new Date('2025-11-29T00:00:00.000Z')

    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token }
    })

    if (!link) {
      console.log('❌ Link not found')
      return
    }

    const clinicId = link.clinicId
    const year = link.year
    const month = link.month

    console.log('📋 기본 정보:', { clinicId, year, month })

    // 휴무일 설정
    const closedDaySettings = await prisma.closedDaySettings.findUnique({
      where: { clinicId },
      select: { regularDays: true }
    })
    const regularClosedDays = closedDaySettings?.regularDays || []
    console.log('🚫 정기 휴무일:', regularClosedDays)

    // 총 직원 수
    const totalStaffCount = await prisma.staff.count({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      }
    })
    console.log('👥 총 직원 수:', totalStaffCount)

    // 해당 기간의 원장 스케줄 조회
    const scheduleDoctors = await prisma.scheduleDoctor.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        schedule: {
          clinicId,
          year,
          month
        }
      },
      include: {
        doctor: {
          select: {
            id: true,
            shortName: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    console.log('\n📊 총 ScheduleDoctor 레코드 수:', scheduleDoctors.length)

    // 날짜별로 그룹화
    const dateGroups = new Map()
    for (const sd of scheduleDoctors) {
      const dateStr = sd.date.toISOString().split('T')[0]
      if (!dateGroups.has(dateStr)) {
        dateGroups.set(dateStr, [])
      }
      dateGroups.get(dateStr).push(sd)
    }

    console.log('📅 고유 날짜 수:', dateGroups.size)

    // 날짜별 슬롯 계산
    let totalSlots = 0
    const dateDetails = []

    for (const [dateStr, doctors] of dateGroups.entries()) {
      const date = new Date(dateStr)
      const dayOfWeek = date.getUTCDay()

      // 휴무일 체크
      if (regularClosedDays.includes(dayOfWeek)) {
        console.log(`⏭️ ${dateStr} (${dayOfWeek}) - 휴무일 건너뜀`)
        continue
      }

      // 원장 조합 찾기 (중복 제거)
      const uniqueDoctorNames = Array.from(new Set(doctors.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctors.some(d => d.hasNightShift)

      const doctorCombination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: uniqueDoctorNames },
          hasNightShift: hasNightShift
        }
      })

      if (!doctorCombination) {
        console.log(`❌ ${dateStr} (${dayOfWeek}) - 원장: [${uniqueDoctorNames.join(', ')}] - 조합 없음`)
        continue
      }

      const requiredStaff = doctorCombination.requiredStaff
      const slotsForDate = totalStaffCount - requiredStaff

      totalSlots += slotsForDate

      const detail = {
        date: dateStr,
        dayOfWeek,
        doctors: uniqueDoctorNames.join(', '),
        requiredStaff,
        slots: slotsForDate
      }
      dateDetails.push(detail)

      console.log(`✅ ${dateStr} (${dayOfWeek}) - 원장: [${uniqueDoctorNames.join(', ')}] ${hasNightShift ? '(야간)' : ''} - 필요: ${requiredStaff}명 - 슬롯: ${slotsForDate}`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('📊 최종 결과:')
    console.log('총 슬롯:', totalSlots)
    console.log('총 날짜 수:', dateDetails.length)

    console.log('\n📋 날짜별 상세:')
    let runningTotal = 0
    for (const detail of dateDetails) {
      runningTotal += detail.slots
      console.log(`  ${detail.date} (${detail.dayOfWeek}) - 원장: [${detail.doctors}] - 필요: ${detail.requiredStaff}명 - 슬롯: ${detail.slots} (누적: ${runningTotal})`)
    }

  } catch (error) {
    console.error('❌ 에러:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSlotCalculation()
