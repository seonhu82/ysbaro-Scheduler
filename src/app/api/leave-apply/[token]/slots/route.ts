/**
 * 공개 연차/오프 신청 - 슬롯 현황 조회 API
 * GET /api/leave-apply/[token]/slots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateCategorySlotsFromCombination } from '@/lib/services/category-slot-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    const clinicId = link.clinicId

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

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const current = new Date(d)
      const dateStr = current.toISOString().split('T')[0]

      // 공휴일이면 스킵
      if (isClosedDay(current)) {
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

      // 해당 날짜의 스케줄 조회
      const schedule = await prisma.schedule.findFirst({
        where: { clinicId },
        include: {
          doctors: {
            where: { date },
            include: {
              doctor: { select: { shortName: true } }
            }
          }
        }
      })

      if (schedule && schedule.doctors.length > 0) {
        const doctorShortNames = Array.from(
          new Set(schedule.doctors.map(d => d.doctor.shortName))
        ).sort()
        const hasNightShift = schedule.doctors.some(d => d.hasNightShift)

        // 원장 조합 조회
        const combination = await prisma.doctorCombination.findFirst({
          where: {
            clinicId,
            doctors: { equals: doctorShortNames },
            hasNightShift
          }
        })

        if (combination) {
          dayData.requiredStaff = combination.requiredStaff
          dayData.departmentCategoryStaff = combination.departmentCategoryStaff
        }
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
          in: ['CONFIRMED', 'PENDING', 'ON_HOLD'],
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
        continue
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
      } else if (la.status === 'PENDING') {
        dayData.categorySlots[category].approved++
      } else if (la.status === 'ON_HOLD') {
        dayData.categorySlots[category].onHold++
      }
    }

    // 각 날짜의 구분별 슬롯 계산 (기존 함수 재사용)
    for (const [dateStr, dayData] of dateMap.entries()) {
      const date = new Date(dateStr)

      if (!dayData.categorySlots) {
        dayData.categorySlots = {}
        dayData.offAssigned = 0
        dayData.annualAssigned = 0
      }

      // departmentCategoryStaff가 있으면 calculateCategorySlotsFromCombination 사용
      if (dayData.departmentCategoryStaff) {
        // 자동배치 사용 부서 조회
        const departments = await prisma.department.findMany({
          where: {
            clinicId,
            useAutoAssignment: true,
          },
        })

        // 각 부서별로 슬롯 계산
        for (const dept of departments) {
          const categorySlots = await calculateCategorySlotsFromCombination(
            clinicId,
            date,
            dayData.departmentCategoryStaff,
            dept.name
          )

          // 결과 병합
          for (const [categoryName, slotInfo] of Object.entries(categorySlots)) {
            dayData.categorySlots[categoryName] = slotInfo
          }
        }
      }

      // totalAvailable 계산
      let totalAvailable = 0
      for (const slot of Object.values(dayData.categorySlots)) {
        totalAvailable += (slot as any).available
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
