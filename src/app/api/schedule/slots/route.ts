import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/schedule/slots
 * 구간별 슬롯 현황 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const clinicId = user.clinicId

    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    // 공휴일 설정 조회
    const closedDaySettings = await prisma.closedDaySettings.findUnique({
      where: { clinicId },
    })

    // Helper function: 날짜가 공휴일인지 확인
    const isClosedDay = (date: Date): boolean => {
      if (!closedDaySettings) return false

      const dateStr = date.toISOString().split('T')[0]
      const dayOfWeek = date.getDay()

      // 특정 날짜 확인
      if (closedDaySettings.specificDates.includes(dateStr)) {
        return true
      }

      // 정규 휴일 확인
      const regularDays = closedDaySettings.regularDays as any

      // regularDays가 숫자 배열인 경우 (예: [0] = 일요일)
      if (Array.isArray(regularDays)) {
        if (regularDays.includes(dayOfWeek)) {
          return true
        }
      }
      // regularDays가 객체 배열인 경우 (예: [{dayOfWeek: "SUNDAY", weekOfMonth: 2}])
      else if (regularDays && regularDays.length > 0) {
        const dayOfWeekString = getDayOfWeekString(dayOfWeek)

        for (const rule of regularDays) {
          if (typeof rule === 'object' && rule.dayOfWeek === dayOfWeekString) {
            // weekOfMonth가 없으면 매주
            if (!rule.weekOfMonth) {
              return true
            }

            // weekOfMonth가 있으면 해당 주차만
            const weekOfMonth = Math.ceil(date.getDate() / 7)
            if (rule.weekOfMonth === weekOfMonth) {
              return true
            }
          }
        }
      }

      return false
    }

    // 날짜 범위의 모든 날짜 생성 (공휴일 제외)
    const dateMap = new Map<string, any>()
    const start = new Date(startDate)
    const end = new Date(endDate)

    console.log('[Slots API] Date range:', startDate, 'to', endDate)
    console.log('[Slots API] Closed day settings:', JSON.stringify(closedDaySettings?.regularDays))

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const current = new Date(d)
      const dateStr = current.toISOString().split('T')[0]
      const dayOfWeek = current.getDay()

      // 공휴일이면 스킵
      const isClosed = isClosedDay(current)
      console.log(`[Slots API] ${dateStr} (${dayOfWeek}) - Closed: ${isClosed}`)

      if (isClosed) {
        continue
      }

      dateMap.set(dateStr, {
        date: dateStr,
        dayOfWeek: current.getDay(),
        hasNightShift: false,
        doctors: [],
        requiredStaff: 0,
      })
    }

    console.log('[Slots API] Total dates generated:', dateMap.size)

    // 해당 기간의 스케줄 조회
    const scheduleDoctors = await prisma.scheduleDoctor.findMany({
      where: {
        schedule: { clinicId },
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        schedule: true,
        doctor: true,
      },
      orderBy: {
        date: 'asc',
      },
    })

    // 스케줄 정보 추가
    for (const sd of scheduleDoctors) {
      const dateStr = sd.date.toISOString().split('T')[0]

      if (dateMap.has(dateStr)) {
        const dayData = dateMap.get(dateStr)
        dayData.doctors.push(sd.doctor.name)
        if (sd.hasNightShift) {
          dayData.hasNightShift = true
        }
      }
    }

    // 날짜별 원장 조합 조회하여 필요 인원 계산
    for (const [dateStr, dayData] of dateMap.entries()) {
      const date = new Date(dateStr)
      const dayOfWeek = date.getDay()

      // 해당 요일의 원장 조합 조회
      const combinations = await prisma.doctorCombination.findMany({
        where: {
          clinicId,
          dayOfWeek: getDayOfWeekString(dayOfWeek),
        },
      })

      if (combinations.length > 0) {
        // 가장 큰 requiredStaff 사용
        dayData.requiredStaff = Math.max(...combinations.map(c => c.requiredStaff))
      }
    }

    // 해당 기간의 휴가 신청 조회
    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: {
          in: ['CONFIRMED', 'ON_HOLD'],
        },
      },
      include: {
        staff: true,
      },
    })

    // 날짜별 휴가 정보 추가
    for (const la of leaveApplications) {
      const dateStr = la.date.toISOString().split('T')[0]

      if (!dateMap.has(dateStr)) {
        const date = new Date(dateStr)
        dateMap.set(dateStr, {
          date: dateStr,
          dayOfWeek: date.getDay(),
          hasNightShift: false,
          doctors: [],
          requiredStaff: 0,
        })
      }

      const dayData = dateMap.get(dateStr)

      if (!dayData.categorySlots) {
        dayData.categorySlots = {}
        dayData.offAssigned = 0
        dayData.annualAssigned = 0
      }

      const category = la.staff.categoryName || '미지정'

      if (!dayData.categorySlots[category]) {
        dayData.categorySlots[category] = {
          required: 0,
          available: 0,
          approved: 0,
          onHold: 0,
        }
      }

      if (la.status === 'CONFIRMED') {
        dayData.categorySlots[category].approved++
        if (la.leaveType === 'OFF') {
          dayData.offAssigned++
        } else if (la.leaveType === 'ANNUAL') {
          dayData.annualAssigned++
        }
      } else if (la.status === 'ON_HOLD') {
        dayData.categorySlots[category].onHold++
      }
    }

    // 각 날짜의 구분별 필요 인원 및 가용 인원 계산
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실',
      },
    })

    for (const [dateStr, dayData] of dateMap.entries()) {
      if (!dayData.categorySlots) {
        dayData.categorySlots = {}
        dayData.offAssigned = 0
        dayData.annualAssigned = 0
      }

      // 구분별 직원 수 계산
      const categoryCount: Record<string, number> = {}
      for (const staff of allStaff) {
        const category = staff.categoryName || '미지정'
        categoryCount[category] = (categoryCount[category] || 0) + 1
      }

      // 구분별 슬롯 정보 설정
      let totalAvailable = 0
      for (const [category, count] of Object.entries(categoryCount)) {
        if (!dayData.categorySlots[category]) {
          dayData.categorySlots[category] = {
            required: 0,
            available: 0,
            approved: 0,
            onHold: 0,
          }
        }

        const slot = dayData.categorySlots[category]
        // 간단한 계산: 전체 필요 인원을 구분별 비율로 나눔
        const ratio = count / allStaff.length
        slot.required = Math.round(dayData.requiredStaff * ratio)
        slot.available = count - slot.approved - slot.onHold
        totalAvailable += slot.available
      }

      dayData.totalAvailable = totalAvailable
    }

    const result = Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )

    return NextResponse.json({
      success: true,
      status: result,
    })
  } catch (error) {
    console.error('Slot status error:', error)
    return NextResponse.json(
      { error: '슬롯 현황 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

function getDayOfWeekString(dayOfWeek: number): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  return days[dayOfWeek]
}
