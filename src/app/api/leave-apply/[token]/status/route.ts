import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateCategorySlots } from '@/lib/services/category-slot-service'

// 주의 시작일(일요일) 계산
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day // 일요일이 0
  d.setUTCDate(d.getUTCDate() - diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token }
    })

    if (!link) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    const clinicId = link.clinicId
    const start = new Date(startDate)
    const end = new Date(endDate)

    // 규칙 설정 조회 (총 직원 수, 주 근무일 등)
    const ruleSettings = await prisma.ruleSettings.findUnique({
      where: { clinicId },
      select: {
        staffCategories: true,
        weekBusinessDays: true,
        defaultWorkDays: true
      }
    })

    // 휴무일 설정 조회
    const closedDaySettings = await prisma.closedDaySettings.findUnique({
      where: { clinicId },
      select: { regularDays: true }
    })

    const regularClosedDays = (closedDaySettings?.regularDays as number[]) || []
    const weekBusinessDays = ruleSettings?.weekBusinessDays || 6 // 주 영업일 (일요일 제외 6일)
    const defaultWorkDays = ruleSettings?.defaultWorkDays || 4 // 주 근무일 (4일)

    // 총 활성 직원 수 조회
    const totalStaffCount = await prisma.staff.count({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실' // 자동배치 사용 부서
      }
    })

    // 슬롯은 날짜별로 계산됨 (오프/연차 구분 없이)

    // 해당 기간의 원장 스케줄 조회
    const year = link.year
    const month = link.month

    // 공휴일 조회
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: start,
          lte: end
        }
      }
    })
    const holidayDates = new Set(
      holidays.map(h => h.date.toISOString().split('T')[0])
    )

    const scheduleDoctors = await prisma.scheduleDoctor.findMany({
      where: {
        date: {
          gte: start,
          lte: end
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

    // 날짜별로 그룹화
    const dateGroups = new Map<string, typeof scheduleDoctors>()
    for (const sd of scheduleDoctors) {
      const dateStr = sd.date.toISOString().split('T')[0]
      if (!dateGroups.has(dateStr)) {
        dateGroups.set(dateStr, [])
      }
      dateGroups.get(dateStr)!.push(sd)
    }

    // 날짜별 슬롯 계산
    let totalSlots = 0
    const dateStatuses = []

    console.log('📊 [슬롯 계산] 총 날짜 수:', dateGroups.size)

    for (const [dateStr, doctors] of dateGroups.entries()) {
      const date = new Date(dateStr)
      const dayOfWeek = date.getUTCDay()
      const isHoliday = holidayDates.has(dateStr)

      // 휴무일은 제외 (공휴일은 처리함)
      if (regularClosedDays.includes(dayOfWeek) && !isHoliday) {
        console.log(`⏭️ [슬롯 계산] ${dateStr} 건너뜀 (휴무일)`)
        continue
      }

      // 원장 조합으로 필요 직원 수 찾기 (중복 제거)
      const uniqueDoctorNames = Array.from(new Set(doctors.map(d => d.doctor.shortName))).sort()
      const hasNightShift = doctors.some(d => d.hasNightShift)
      console.log(`🔍 [슬롯 계산] ${dateStr}: 원장 ${uniqueDoctorNames.join(', ')}, 야간: ${hasNightShift}`)

      const doctorCombination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: { equals: uniqueDoctorNames },
          hasNightShift: hasNightShift
        }
      })

      if (!doctorCombination) {
        console.log(`❌ [슬롯 계산] ${dateStr}: 조합 없음`)
        continue
      }

      const requiredStaff = doctorCombination.requiredStaff
      const slotsForDate = totalStaffCount - requiredStaff

      console.log(`✅ [슬롯 계산] ${dateStr}: 필요 ${requiredStaff}명, 슬롯 ${slotsForDate}`)

      totalSlots += slotsForDate

      dateStatuses.push({
        date: dateStr,
        requiredStaff,
        slotsForDate,
        isHoliday
      })
    }

    console.log('📊 [슬롯 계산] 총 슬롯:', totalSlots)

    // 이미 신청된 연차/오프 개수 조회
    const applications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        linkId: link.id,
        date: {
          gte: start,
          lte: end
        },
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
      },
      select: {
        leaveType: true
      }
    })

    const appliedCount = applications.length
    const appliedOffCount = applications.filter(a => a.leaveType === 'OFF').length
    const appliedAnnualCount = applications.filter(a => a.leaveType === 'ANNUAL').length

    // OFF/연차 슬롯 구분 계산
    // 주 수 계산
    const weekStarts = new Set<string>()
    let currentDate = new Date(start)
    while (currentDate <= end) {
      const weekStart = getWeekStart(currentDate)
      weekStarts.add(weekStart.toISOString())
      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }
    const weekCount = weekStarts.size

    // OFF 슬롯 = 주 수 × 직원 수 × (영업일 - 주근무일)
    const totalOffSlots = weekCount * totalStaffCount * (weekBusinessDays - defaultWorkDays)
    // 연차 슬롯 = 전체 슬롯 - OFF 슬롯
    const totalAnnualSlots = totalSlots - totalOffSlots

    // 신청 가능 슬롯
    const availableOffSlots = totalOffSlots - appliedOffCount
    const availableAnnualSlots = totalAnnualSlots - appliedAnnualCount
    const availableSlots = totalSlots - appliedCount

    return NextResponse.json({
      success: true,
      summary: {
        totalStaffCount, // 총 직원 수
        totalSlots, // 전체 휴무 슬롯 (오프+연차)
        totalOffSlots, // 전체 OFF 슬롯
        totalAnnualSlots, // 전체 연차 슬롯
        appliedOffCount, // 신청된 오프
        appliedAnnualCount, // 신청된 연차
        appliedCount, // 총 신청된 수
        availableSlots, // 남은 슬롯 (전체)
        availableOffSlots, // 신청 가능 OFF
        availableAnnualSlots, // 신청 가능 연차
        holidayDates: Array.from(holidayDates) // 공휴일 목록
      }
    })

  } catch (error) {
    console.error('Get status error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
