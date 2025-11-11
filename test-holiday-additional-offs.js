const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testHolidayAdditionalOffs() {
  try {
    const clinicId = 'cmh697itv0001fw83azbrqe60'
    const year = 2025
    const month = 8

    console.log(`\n📊 ${year}년 ${month}월 공휴일 추가 OFF 계산 테스트\n`)
    console.log('='.repeat(80))

    // 병원 설정
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    })

    const weekBusinessDays = clinic?.weekBusinessDays || 6
    const defaultWorkDays = clinic?.defaultWorkDays || 4

    console.log(`\n🏥 병원 설정:`)
    console.log(`   - 주간 영업일: ${weekBusinessDays}일`)
    console.log(`   - 기본 근무일: ${defaultWorkDays}일`)

    // 전체 직원 수
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      }
    })

    console.log(`   - 전체 직원: ${allStaff.length}명`)

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: { clinicId, year, month },
      include: {
        staffAssignments: true
      }
    })

    if (!schedule) {
      console.log('\n❌ 스케줄이 없습니다.')
      return
    }

    // 공휴일 조회
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1)
        }
      }
    })

    console.log(`\n\n📅 공휴일: ${holidays.length}개\n`)

    for (const holiday of holidays) {
      const holidayDateStr = holiday.date.toISOString().split('T')[0]
      const holidayDate = new Date(holiday.date)
      const dayOfWeek = holidayDate.getDay()

      console.log(`🎌 ${holidayDateStr} (${holiday.name}) - 요일: ${['일', '월', '화', '수', '목', '금', '토'][dayOfWeek]}`)

      // 해당 날짜의 전체 배치
      const totalAssignments = schedule.staffAssignments.filter(
        a => new Date(a.date).toISOString().split('T')[0] === holidayDateStr
      )

      const offAssignments = totalAssignments.filter(a => a.shiftType === 'OFF')
      const workAssignments = totalAssignments.filter(a => a.shiftType !== 'OFF')

      console.log(`   전체 배치: ${totalAssignments.length}건`)
      console.log(`   - OFF: ${offAssignments.length}건`)
      console.log(`   - 근무: ${workAssignments.length}건`)

      // 원래 OFF 목표 계산
      const normalOffTarget = (weekBusinessDays - defaultWorkDays) * allStaff.length / weekBusinessDays
      console.log(`\n   계산:`)
      console.log(`   - 원래 OFF 목표: (${weekBusinessDays} - ${defaultWorkDays}) × ${allStaff.length} ÷ ${weekBusinessDays} = ${normalOffTarget.toFixed(1)}`)
      console.log(`   - 반올림: ${Math.round(normalOffTarget)}명`)

      // 공휴일로 인해 추가 OFF된 인원
      const additionalOffs = Math.max(0, totalAssignments.length - Math.round(normalOffTarget))
      console.log(`   - 공휴일 추가 OFF: ${totalAssignments.length} - ${Math.round(normalOffTarget)} = ${additionalOffs}명`)

      console.log(`\n   ✅ 결과: "${additionalOffs}명을 추가 OFF 처리"`)
      console.log(`   📊 설명: 원래 ${Math.round(normalOffTarget)}명 OFF + 공휴일 추가 ${additionalOffs}명 = 총 ${totalAssignments.length}명 OFF\n`)
    }

    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ 오류:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testHolidayAdditionalOffs()
