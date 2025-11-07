/**
 * 월간 캘린더 뷰 데이터 API
 * GET /api/schedule/monthly-view?year=2025&month=1
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { getAutoAssignDepartmentNamesWithFallback, getCategoryOrderMap } from '@/lib/utils/department-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')
    const statusParam = searchParams.get('status') // 'DRAFT' or 'DEPLOYED'

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid year or month' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    // 스케줄 조회 조건 결정
    // status 파라미터가 없으면 DEPLOYED만 조회 (메인 대시보드용)
    // status='DRAFT'면 DRAFT만 조회 (Wizard Step 4용)
    // status='CONFIRMED'면 CONFIRMED만 조회
    // status='DEPLOYED'면 DEPLOYED만 조회
    const scheduleStatus = statusParam || 'DEPLOYED'

    // 캘린더 그리드 날짜 범위 계산 (이전/다음 달 포함)
    const monthStart = startOfMonth(new Date(year, month - 1, 1))
    const monthEnd = endOfMonth(new Date(year, month - 1, 1))
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    // 현재 월 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month,
        status: scheduleStatus as any
      },
      include: {
        doctors: {
          include: {
            doctor: true
          }
        },
        staffAssignments: {
          include: {
            staff: true
          }
        }
      }
    })

    // 이전/다음 달 DEPLOYED는 현재 월 스케줄이 있을 때만 조회
    // (CONFIRMED나 DRAFT 스케줄이 없으면 이전 달 데이터도 가져오지 않음)
    let prevSchedule = null
    let nextSchedule = null

    if (schedule) {
      // 이전 달의 DEPLOYED 스케줄 조회 (캘린더 시작 ~ 현재 월 끝까지)
      // 현재 달에 속하지만 이전 달 스케줄에 포함된 날짜도 가져옴 (예: 2월 1일이 1월 DEPLOYED에 있는 경우)
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      prevSchedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: prevYear,
        month: prevMonth,
        status: 'DEPLOYED'
      },
      include: {
        doctors: {
          include: {
            doctor: true
          },
          where: {
            date: {
              gte: calendarStart,
              lte: monthEnd // 현재 월 끝까지
            }
          }
        },
        staffAssignments: {
          include: {
            staff: true
          },
          where: {
            date: {
              gte: calendarStart,
              lte: monthEnd
            }
          }
        }
      }
      })

      // 다음 달의 DEPLOYED 스케줄 조회 (캘린더 범위에 포함되는 날짜만)
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? year + 1 : year
      nextSchedule = await prisma.schedule.findFirst({
        where: {
          clinicId,
          year: nextYear,
          month: nextMonth,
          status: 'DEPLOYED'
        },
        include: {
          doctors: {
            include: {
              doctor: true
            },
            where: {
              date: {
                gt: monthEnd,
                lte: calendarEnd
              }
            }
          },
          staffAssignments: {
            include: {
              staff: true
            },
            where: {
              date: {
                gt: monthEnd,
                lte: calendarEnd
              }
            }
          }
        }
      })
    }

    // 연차/오프 신청 조회
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0)
        }
      },
      include: {
        staff: true
      }
    })

    // 공휴일 조회 (캘린더 그리드가 표시하는 전체 범위)
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: calendarStart,
          lte: calendarEnd
        }
      },
      select: {
        date: true,
        name: true
      }
    })

    // 공휴일 맵 생성 (날짜 -> 공휴일명)
    const holidayMap = new Map<string, string>()
    holidays.forEach(holiday => {
      const dateKey = new Date(holiday.date).toISOString().split('T')[0]
      holidayMap.set(dateKey, holiday.name)
    })

    // 의사 조합 정보 조회
    const combinations = await prisma.doctorCombination.findMany({
      where: { clinicId }
    })

    // 자동 배치 부서의 전체 활성 직원 수 조회 (오프 계산용)
    const autoAssignDeptNames = await getAutoAssignDepartmentNamesWithFallback(clinicId)
    const totalActiveStaff = await prisma.staff.count({
      where: {
        clinicId,
        isActive: true,
        departmentName: { in: autoAssignDeptNames }
      }
    })

    // 모든 스케줄 데이터 병합 (현재 월 우선, 중복 제거)
    const currentDoctors = schedule?.doctors || []
    const currentStaff = schedule?.staffAssignments || []

    // 현재 월 스케줄에 이미 있는 날짜는 제외
    const currentDoctorDates = new Set(currentDoctors.map(d => new Date(d.date).toISOString().split('T')[0]))
    const currentStaffDates = new Set(currentStaff.map(s => new Date(s.date).toISOString().split('T')[0]))

    const prevDoctors = (prevSchedule?.doctors || []).filter(d =>
      !currentDoctorDates.has(new Date(d.date).toISOString().split('T')[0])
    )
    const prevStaff = (prevSchedule?.staffAssignments || []).filter(s =>
      !currentStaffDates.has(new Date(s.date).toISOString().split('T')[0])
    )

    const nextDoctors = (nextSchedule?.doctors || []).filter(d =>
      !currentDoctorDates.has(new Date(d.date).toISOString().split('T')[0])
    )
    const nextStaff = (nextSchedule?.staffAssignments || []).filter(s =>
      !currentStaffDates.has(new Date(s.date).toISOString().split('T')[0])
    )

    const allDoctors = [...currentDoctors, ...prevDoctors, ...nextDoctors]
    const allStaffAssignments = [...currentStaff, ...prevStaff, ...nextStaff]

    // 날짜별로 의사 스케줄 그룹화
    const doctorsByDate = new Map<string, typeof allDoctors>()
    for (const doctorSchedule of allDoctors) {
      const dateKey = new Date(doctorSchedule.date).toISOString().split('T')[0]
      if (!doctorsByDate.has(dateKey)) {
        doctorsByDate.set(dateKey, [])
      }
      doctorsByDate.get(dateKey)!.push(doctorSchedule)
    }

    // 날짜별로 직원 배정 그룹화
    const staffByDate = new Map<string, typeof allStaffAssignments>()
    for (const staffAssignment of allStaffAssignments) {
      const dateKey = new Date(staffAssignment.date).toISOString().split('T')[0]
      if (!staffByDate.has(dateKey)) {
        staffByDate.set(dateKey, [])
      }
      staffByDate.get(dateKey)!.push(staffAssignment)
    }

    // CalendarGrid 형식으로 변환
    const scheduleData: { [key: string]: any } = {}

    doctorsByDate.forEach((doctorSchedules, dateKey) => {
      const doctorShortNames = doctorSchedules.map(ds => ds.doctor.shortName)
      const hasNightShift = doctorSchedules.some(ds => ds.hasNightShift)

      // 의사 조합 찾기
      const combination = combinations.find(c => {
        const comboDoctors = (c.doctors as string[]).sort()
        return JSON.stringify(comboDoctors) === JSON.stringify(doctorShortNames.sort()) &&
               c.hasNightShift === hasNightShift
      })

      const requiredStaff = (combination?.requiredStaff as number) || 0

      // 실제 근무 직원만 카운트 (DAY/NIGHT, OFF 제외)
      const dayStaff = staffByDate.get(dateKey) || []
      const assignedStaff = dayStaff.filter(s => s.shiftType !== 'OFF').length

      // 연차 신청 카운트 (CONFIRMED 또는 ON_HOLD 포함)
      const dayLeaves = leaves.filter(
        l => new Date(l.date).toISOString().split('T')[0] === dateKey
      )
      const annualLeaveCount = dayLeaves.filter(l =>
        (l.status === 'CONFIRMED' || l.status === 'ON_HOLD') && l.leaveType === 'ANNUAL'
      ).length

      // 실제 OFF 배정 카운트 (StaffAssignment의 shiftType='OFF')
      const offCount = dayStaff.filter(s => s.shiftType === 'OFF').length

      scheduleData[dateKey] = {
        combinationName: combination?.name || '조합 미정',
        hasNightShift,
        requiredStaff,
        assignedStaff,
        doctorShortNames,
        annualLeaveCount, // 연차 인원
        offCount, // 오프 인원
        holidayName: holidayMap.get(dateKey) || null // 공휴일명
      }
    })

    // 의사 스케줄이 없는 공휴일도 추가
    holidayMap.forEach((holidayName, dateKey) => {
      if (!scheduleData[dateKey]) {
        scheduleData[dateKey] = {
          combinationName: '',
          hasNightShift: false,
          requiredStaff: 0,
          assignedStaff: 0,
          doctorShortNames: [],
          annualLeaveCount: 0,
          offCount: 0,
          holidayName
        }
      }
    })

    return NextResponse.json({
      success: true,
      scheduleData
    })
  } catch (error) {
    console.error('Error fetching monthly view:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
