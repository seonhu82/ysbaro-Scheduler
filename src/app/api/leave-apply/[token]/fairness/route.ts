/**
 * 공개 연차/오프 신청 - 형평성 정보 API
 * GET /api/leave-apply/[token]/fairness?staffId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: '직원 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // Token 검증
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 직원 정보 조회 (누적 형평성 점수 포함)
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        clinicId: link.clinicId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        departmentName: true,
        categoryName: true,
        fairnessScoreTotalDays: true,
        fairnessScoreNight: true,
        fairnessScoreWeekend: true,
        fairnessScoreHoliday: true,
        fairnessScoreHolidayAdjacent: true,
        totalAnnualDays: true,
        usedAnnualDays: true,
      }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 누적 형평성 점수 사용 (10월까지의 누적)
    const cumulativeFairness = {
      total: staff.fairnessScoreTotalDays || 0,
      night: staff.fairnessScoreNight || 0,
      weekend: staff.fairnessScoreWeekend || 0,
      holiday: staff.fairnessScoreHoliday || 0,
      holidayAdjacent: staff.fairnessScoreHolidayAdjacent || 0,
    }

    // 형평성 설정 조회
    const fairnessSettings = await prisma.fairnessSettings.findUnique({
      where: { clinicId: link.clinicId }
    })

    // 신청 기간 계산
    const year = link.year
    const month = link.month

    // 신청 가능 기간 조회
    const leavePeriod = await prisma.leavePeriod.findFirst({
      where: {
        clinicId: link.clinicId,
        year,
        month,
        isActive: true,
      },
    })

    if (!leavePeriod) {
      return NextResponse.json(
        { success: false, error: '신청 기간이 설정되지 않았습니다' },
        { status: 404 }
      )
    }

    // 실제 신청 가능 기간 계산
    let applicationStartDate = leavePeriod.startDate
    let applicationEndDate = leavePeriod.endDate

    // StaffAssignment 최종일 확인
    const lastStaffAssignment = await prisma.staffAssignment.findFirst({
      where: {
        schedule: { clinicId: link.clinicId },
      },
      orderBy: { date: 'desc' },
      select: { date: true },
    })

    if (lastStaffAssignment?.date) {
      const nextDay = new Date(lastStaffAssignment.date)
      nextDay.setDate(nextDay.getDate() + 1)
      if (nextDay > new Date(leavePeriod.startDate)) {
        applicationStartDate = nextDay
      }
    }

    // ScheduleDoctor 최종일 확인
    const lastDoctorSchedule = await prisma.scheduleDoctor.findFirst({
      where: {
        schedule: { clinicId: link.clinicId },
      },
      orderBy: { date: 'desc' },
      select: { date: true },
    })

    if (lastDoctorSchedule?.date) {
      const doctorEndDate = new Date(lastDoctorSchedule.date)
      const leavePeriodEndDate = new Date(leavePeriod.endDate)
      if (doctorEndDate < leavePeriodEndDate) {
        applicationEndDate = doctorEndDate
      }
    }

    // 신청 가능 기간 내의 근무일만 계산
    const applicableDoctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        schedule: { clinicId: link.clinicId, year, month },
        date: {
          gte: applicationStartDate,
          lte: applicationEndDate,
        }
      },
      select: { date: true },
      distinct: ['date']
    })

    // 일요일 제외한 근무일 수 계산
    const workingDays = applicableDoctorSchedules.filter(ds => {
      const date = new Date(ds.date)
      return date.getDay() !== 0 // 일요일 제외
    }).length

    // 같은 구분 전체 직원 조회 (형평성은 구분별로 계산)
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        isActive: true,
        departmentName: staff.departmentName,
        categoryName: staff.categoryName // 같은 구분만
      },
      select: {
        id: true,
        fairnessScoreTotalDays: true,
      }
    })

    // 누적 편차 평균 계산
    let totalDeviation = 0
    let staffCount = 0
    for (const s of allStaff) {
      if (s.fairnessScoreTotalDays !== null) {
        totalDeviation += s.fairnessScoreTotalDays
        staffCount++
      }
    }

    const avgFairnessScore = staffCount > 0 ? totalDeviation / staffCount : 0

    // 현재 직원의 누적 편차 (양수 = 덜 일함 = 더 신청 가능, 음수 = 많이 일함 = 덜 신청 가능)
    const myFairnessScore = cumulativeFairness.total
    const scoreDifference = myFairnessScore - avgFairnessScore // 내 점수 - 평균 점수

    const baseAllowance = Math.floor(workingDays * 0.3) // 기본 30%
    const fairnessBonus = Math.floor(scoreDifference / 2) // 점수 2점 차이마다 1일 추가
    const maxAllowedDays = Math.max(0, baseAllowance + fairnessBonus)

    // 이미 신청한 오프 일수 계산 (신청 가능 기간만)
    const appliedOffs = await prisma.leaveApplication.count({
      where: {
        staffId: staff.id,
        linkId: link.id,
        status: 'CONFIRMED',
        date: {
          gte: applicationStartDate,
          lte: applicationEndDate,
        }
      }
    })

    // 각 형평성별 커트라인 정보 계산
    const fairnessCutoffs = {
      totalDays: null as { total: number, minRequired: number, maxAllowed: number } | null,
      night: null as { total: number, minRequired: number, maxAllowed: number } | null,
      weekend: null as { total: number, minRequired: number, maxAllowed: number } | null,
      holiday: null as { total: number, minRequired: number, maxAllowed: number } | null,
      holidayAdjacent: null as { total: number, minRequired: number, maxAllowed: number } | null,
    }

    // 총 근무일 형평성 (실제 필요 슬롯 기준)
    if (staff.fairnessScoreTotalDays !== null) {
      // 각 영업일에 필요한 해당 구분 인력 합산
      let totalRequiredSlots = 0
      for (const schedule of applicableDoctorSchedules) {
        const doctorSchedules = await prisma.scheduleDoctor.findMany({
          where: {
            date: schedule.date,
            schedule: { clinicId: link.clinicId, year, month }
          },
          include: {
            doctor: {
              select: { shortName: true }
            }
          }
        })

        if (doctorSchedules.length === 0) continue

        const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
        const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

        const combination = await prisma.doctorCombination.findFirst({
          where: {
            clinicId: link.clinicId,
            doctors: { equals: doctorShortNames },
            hasNightShift
          }
        })

        if (combination) {
          const departmentCategoryStaff = combination.departmentCategoryStaff as {
            [key: string]: {
              [key: string]: { count: number; minRequired: number }
            }
          }
          const treatmentDept = departmentCategoryStaff['진료실'] || {}
          const categoryData = treatmentDept[staff.categoryName]
          const categoryRequired = categoryData?.count || 0
          totalRequiredSlots += categoryRequired
        }
      }

      const baseReq = totalRequiredSlots / allStaff.length
      const adjustedReq = Math.max(0, Math.round(baseReq + staff.fairnessScoreTotalDays))
      const maxAllowed = Math.max(0, workingDays - adjustedReq)

      fairnessCutoffs.totalDays = {
        total: workingDays, // 전체 근무일 수 (표시용)
        minRequired: adjustedReq, // 최소 근무 일수 (슬롯으로 계산)
        maxAllowed: maxAllowed // 최대 신청 일수 (전체 일수 - 최소 근무)
      }
    }

    // 야간 형평성 (신청 가능 기간만, 실제 필요 슬롯 기준)
    if (fairnessSettings?.enableNightShiftFairness && staff.fairnessScoreNight !== null) {
      const nightShiftDatesData = await prisma.scheduleDoctor.findMany({
        where: {
          schedule: { clinicId: link.clinicId, year, month },
          hasNightShift: true,
          date: {
            gte: applicationStartDate,
            lte: applicationEndDate,
          }
        },
        select: { date: true },
        distinct: ['date']
      })
      const nightShiftDates = nightShiftDatesData.length

      // 각 야간 근무일에 필요한 해당 구분 인력 합산
      let totalRequiredSlots = 0
      for (const nightSchedule of nightShiftDatesData) {
        const doctorSchedules = await prisma.scheduleDoctor.findMany({
          where: {
            date: nightSchedule.date,
            schedule: { clinicId: link.clinicId, year, month }
          },
          include: {
            doctor: {
              select: { shortName: true }
            }
          }
        })

        if (doctorSchedules.length === 0) continue

        const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
        const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

        const combination = await prisma.doctorCombination.findFirst({
          where: {
            clinicId: link.clinicId,
            doctors: {
              equals: doctorShortNames
            },
            hasNightShift
          }
        })

        if (combination) {
          const departmentCategoryStaff = combination.departmentCategoryStaff as {
            [key: string]: {
              [key: string]: { count: number; minRequired: number }
            }
          }
          const treatmentDept = departmentCategoryStaff['진료실'] || {}
          const categoryData = treatmentDept[staff.categoryName]
          const categoryRequired = categoryData?.count || 0
          totalRequiredSlots += categoryRequired
        }
      }

      const baseReq = totalRequiredSlots / allStaff.length
      const adjustedReq = Math.max(0, Math.round(baseReq + staff.fairnessScoreNight))
      const maxAllowed = Math.max(0, nightShiftDates - adjustedReq)

      fairnessCutoffs.night = {
        total: nightShiftDates, // 전체 야간 일수 (표시용)
        minRequired: adjustedReq, // 최소 근무 일수 (슬롯으로 계산)
        maxAllowed: maxAllowed // 최대 신청 일수 (전체 일수 - 최소 근무)
      }
    }

    // 주말 형평성 (신청 가능 기간만, 실제 필요 슬롯 기준)
    if (fairnessSettings?.enableWeekendFairness && staff.fairnessScoreWeekend !== null) {
      const saturdaySchedules = applicableDoctorSchedules.filter(ds => {
        const date = new Date(ds.date)
        return date.getDay() === 6 // 토요일만
      })
      const saturdays = saturdaySchedules.length

      // 각 토요일에 필요한 해당 구분 인력 합산
      let totalRequiredSlots = 0
      for (const saturdaySchedule of saturdaySchedules) {
        const doctorSchedules = await prisma.scheduleDoctor.findMany({
          where: {
            date: saturdaySchedule.date,
            schedule: { clinicId: link.clinicId, year, month }
          },
          include: {
            doctor: {
              select: { shortName: true }
            }
          }
        })

        if (doctorSchedules.length === 0) continue

        const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
        const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

        const combination = await prisma.doctorCombination.findFirst({
          where: {
            clinicId: link.clinicId,
            doctors: { equals: doctorShortNames },
            hasNightShift
          }
        })

        if (combination) {
          const departmentCategoryStaff = combination.departmentCategoryStaff as {
            [key: string]: {
              [key: string]: { count: number; minRequired: number }
            }
          }
          const treatmentDept = departmentCategoryStaff['진료실'] || {}
          const categoryData = treatmentDept[staff.categoryName]
          const categoryRequired = categoryData?.count || 0
          totalRequiredSlots += categoryRequired
        }
      }

      const baseReq = totalRequiredSlots / allStaff.length
      const adjustedReq = Math.max(0, Math.round(baseReq + staff.fairnessScoreWeekend))
      const maxAllowed = Math.max(0, saturdays - adjustedReq)

      fairnessCutoffs.weekend = {
        total: saturdays, // 전체 주말 일수 (표시용)
        minRequired: adjustedReq, // 최소 근무 일수 (슬롯으로 계산)
        maxAllowed: maxAllowed // 최대 신청 일수 (전체 일수 - 최소 근무)
      }
    }

    // 공휴일 형평성 (신청 가능 기간만, 실제 필요 슬롯 기준)
    if (fairnessSettings?.enableHolidayFairness && staff.fairnessScoreHoliday !== null) {
      const holidayDates = await prisma.holiday.findMany({
        where: {
          clinicId: link.clinicId,
          date: {
            gte: applicationStartDate,
            lte: applicationEndDate
          }
        },
        select: { date: true }
      })
      const holidays = holidayDates.length

      // 각 공휴일에 필요한 해당 구분 인력 합산
      let totalRequiredSlots = 0
      for (const holiday of holidayDates) {
        const doctorSchedules = await prisma.scheduleDoctor.findMany({
          where: {
            date: holiday.date,
            schedule: { clinicId: link.clinicId, year, month }
          },
          include: {
            doctor: {
              select: { shortName: true }
            }
          }
        })

        if (doctorSchedules.length === 0) continue

        const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
        const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

        const combination = await prisma.doctorCombination.findFirst({
          where: {
            clinicId: link.clinicId,
            doctors: {
              equals: doctorShortNames
            },
            hasNightShift
          }
        })

        if (combination) {
          const departmentCategoryStaff = combination.departmentCategoryStaff as {
            [key: string]: {
              [key: string]: { count: number; minRequired: number }
            }
          }
          const treatmentDept = departmentCategoryStaff['진료실'] || {}
          const categoryData = treatmentDept[staff.categoryName]
          const categoryRequired = categoryData?.count || 0
          totalRequiredSlots += categoryRequired
        }
      }

      const baseReq = totalRequiredSlots / allStaff.length
      const adjustedReq = Math.max(0, Math.round(baseReq + staff.fairnessScoreHoliday))
      const maxAllowed = Math.max(0, holidays - adjustedReq)

      fairnessCutoffs.holiday = {
        total: holidays, // 전체 공휴일 일수
        minRequired: adjustedReq, // 최소 근무 일수
        maxAllowed: maxAllowed // 최대 신청 일수 (전체 일수 - 최소 근무)
      }
    }

    // 공휴일 전후 형평성 (신청 가능 기간만, 실제 필요 슬롯 기준)
    if (fairnessSettings?.enableHolidayAdjacentFairness && staff.fairnessScoreHolidayAdjacent !== null) {
      const holidays = await prisma.holiday.findMany({
        where: {
          clinicId: link.clinicId,
          date: {
            gte: applicationStartDate,
            lte: applicationEndDate
          }
        },
        select: { date: true }
      })

      const adjacentDatesList: Date[] = []
      for (const { date } of holidays) {
        const dayOfWeek = date.getDay()
        if (dayOfWeek === 1) { // 월요일이면 전날 금요일
          const friday = new Date(date)
          friday.setDate(friday.getDate() - 3)
          // 신청 가능 기간 내에 있는지 확인
          if (friday >= applicationStartDate && friday <= applicationEndDate) {
            adjacentDatesList.push(friday)
          }
        }
        if (dayOfWeek === 5) { // 금요일이면 다음날 월요일
          const monday = new Date(date)
          monday.setDate(monday.getDate() + 3)
          // 신청 가능 기간 내에 있는지 확인
          if (monday >= applicationStartDate && monday <= applicationEndDate) {
            adjacentDatesList.push(monday)
          }
        }
      }

      // 각 공휴일 전후일에 필요한 해당 구분 인력 합산
      let totalRequiredSlots = 0
      for (const adjacentDate of adjacentDatesList) {
        const doctorSchedules = await prisma.scheduleDoctor.findMany({
          where: {
            date: adjacentDate,
            schedule: { clinicId: link.clinicId, year, month }
          },
          include: {
            doctor: {
              select: { shortName: true }
            }
          }
        })

        if (doctorSchedules.length === 0) continue

        const doctorShortNames = Array.from(new Set(doctorSchedules.map(d => d.doctor.shortName))).sort()
        const hasNightShift = doctorSchedules.some(d => d.hasNightShift)

        const combination = await prisma.doctorCombination.findFirst({
          where: {
            clinicId: link.clinicId,
            doctors: {
              equals: doctorShortNames
            },
            hasNightShift
          }
        })

        if (combination) {
          const departmentCategoryStaff = combination.departmentCategoryStaff as {
            [key: string]: {
              [key: string]: { count: number; minRequired: number }
            }
          }
          const treatmentDept = departmentCategoryStaff['진료실'] || {}
          const categoryData = treatmentDept[staff.categoryName]
          const categoryRequired = categoryData?.count || 0
          totalRequiredSlots += categoryRequired
        }
      }

      const baseReq = totalRequiredSlots / allStaff.length
      const adjustedReq = Math.max(0, Math.round(baseReq + staff.fairnessScoreHolidayAdjacent))
      const maxAllowed = Math.max(0, adjacentDatesList.length - adjustedReq)

      fairnessCutoffs.holidayAdjacent = {
        total: adjacentDatesList.length, // 전체 공휴일 전후 일수
        minRequired: adjustedReq, // 최소 근무 일수
        maxAllowed: maxAllowed // 최대 신청 일수 (전체 일수 - 최소 근무)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        staffName: staff.name,
        targetMonth: `${link.month}월`,
        fairnessScores: {
          totalDays: cumulativeFairness.total,
          night: cumulativeFairness.night,
          weekend: cumulativeFairness.weekend,
          holiday: cumulativeFairness.holiday,
          holidayAdjacent: cumulativeFairness.holidayAdjacent,
        },
        fairnessCutoffs,
        monthlyStats: {
          workingDays,
          appliedOffs,
          maxAllowedDays,
          remainingDays: Math.max(0, maxAllowedDays - appliedOffs),
          avgFairnessScore: Math.round(avgFairnessScore * 10) / 10, // 소수점 1자리
          myFairnessScore,
        },
        annualLeave: {
          total: staff.totalAnnualDays,
          used: staff.usedAnnualDays,
          remaining: staff.totalAnnualDays - staff.usedAnnualDays,
        },
        fairnessSettings: fairnessSettings ? {
          enableNightShift: fairnessSettings.enableNightShiftFairness,
          enableWeekend: fairnessSettings.enableWeekendFairness,
          enableHoliday: fairnessSettings.enableHolidayFairness,
          enableHolidayAdjacent: fairnessSettings.enableHolidayAdjacentFairness,
        } : null,
      }
    })
  } catch (error: any) {
    console.error('형평성 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '형평성 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
