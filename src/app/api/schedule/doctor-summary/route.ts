import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/schedule/doctor-summary
 * 특정 월의 원장 스케줄 요약
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    const clinicId = session.user.clinicId

    // 해당 월의 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month
      }
    })

    if (!schedule) {
      return NextResponse.json({
        success: true,
        hasSchedule: false,
        doctorSchedules: [],
        slots: []
      })
    }

    // 원장 스케줄 조회
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        scheduleId: schedule.id
      },
      include: {
        doctor: true
      },
      orderBy: {
        date: 'asc'
      }
    })

    // 휴무일 설정 조회
    const closedDaySettings = await prisma.closedDaySettings.findUnique({
      where: { clinicId }
    })

    // 정기 휴무일 (0=일요일, 1=월요일, ..., 6=토요일)
    const regularClosedDays = closedDaySettings?.regularDays
      ? (closedDaySettings.regularDays as number[])
      : []

    // 원장별 근무 통계 (모든 날짜 포함)
    const doctorStats = doctorSchedules.reduce((acc, ds) => {
      const name = ds.doctor.name
      if (!acc[name]) {
        acc[name] = {
          doctorName: name,
          totalDays: 0,
          nightShifts: 0
        }
      }
      acc[name].totalDays++
      if (ds.hasNightShift) {
        acc[name].nightShifts++
      }
      return acc
    }, {} as Record<string, any>)

    // 일별 슬롯 정보 (원장 조합별로 그룹화, 모든 날짜 포함)
    const dayOfWeekMap = ['일', '월', '화', '수', '목', '금', '토']
    const slotsByDate = doctorSchedules.reduce((acc, ds) => {
      const dayOfWeek = ds.date.getDay()

      const dateStr = ds.date.toISOString().split('T')[0]
      if (!acc[dateStr]) {
        acc[dateStr] = {
          date: dateStr,
          dayOfWeek: dayOfWeekMap[dayOfWeek],
          doctors: [],
          doctorShortNames: [],
          hasNightShift: false
        }
      }
      acc[dateStr].doctors.push(ds.doctor.name)
      acc[dateStr].doctorShortNames.push(ds.doctor.shortName)
      if (ds.hasNightShift) {
        acc[dateStr].hasNightShift = true
      }
      return acc
    }, {} as Record<string, any>)

    // 진료실 직원 총원 (categoryName이 있는 직원만) - 한 번만 조회
    const totalTreatmentStaff = await prisma.staff.count({
      where: {
        clinicId,
        isActive: true,
        categoryName: { not: null },
        departmentName: '진료실'
      }
    })

    // 모든 DoctorCombination 조회 (한 번만 조회)
    const allCombinations = await prisma.doctorCombination.findMany({
      where: {
        clinicId
      }
    })

    // 각 슬롯에 대해 DoctorCombination에서 requiredStaff 조회
    const slots = Object.values(slotsByDate).map((slot: any) => {
      const doctorShortNames = slot.doctorShortNames.sort().join(',')

      // 원장 조합 찾기 (배열 순서 무시하고 정렬해서 비교)
      const combination = allCombinations.find(c => {
        const combDoctors = (c.doctors as string[]).sort().join(',')
        return combDoctors === doctorShortNames && c.hasNightShift === slot.hasNightShift
      })

      const requiredStaff = combination?.requiredStaff || 0
      const availableSlots = totalTreatmentStaff - requiredStaff

      return {
        date: slot.date,
        dayOfWeek: slot.dayOfWeek,
        doctors: slot.doctors,
        hasNightShift: slot.hasNightShift,
        requiredStaff,
        availableSlots
      }
    })

    return NextResponse.json({
      success: true,
      hasSchedule: true,
      doctorSchedules: Object.values(doctorStats),
      slots,
      weekPatterns: schedule.weekPatterns || null, // 주차별 패턴 정보 추가
      schedule: {
        id: schedule.id,
        status: schedule.status,
        deployedAt: schedule.deployedAt,
        deployedStartDate: schedule.deployedStartDate,
        deployedEndDate: schedule.deployedEndDate
      }
    })

  } catch (error) {
    console.error('Doctor schedule summary error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load doctor schedule summary' },
      { status: 500 }
    )
  }
}
