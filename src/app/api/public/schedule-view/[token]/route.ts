/**
 * 공개 스케줄 조회 API
 * GET: 토큰으로 스케줄 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    // 토큰으로 링크 조회
    const link = await prisma.scheduleViewLink.findUnique({
      where: { token: params.token },
      include: {
        clinic: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 만료 확인
    if (link.expiresAt && link.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: '만료된 링크입니다' },
        { status: 401 }
      )
    }

    const clinicId = link.clinic.id

    // 캘린더 그리드 날짜 범위 계산 (이전/다음 달 포함)
    const monthStart = startOfMonth(new Date(year, month - 1, 1))
    const monthEnd = endOfMonth(new Date(year, month - 1, 1))
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    // 현재 월 DEPLOYED 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month,
        status: 'DEPLOYED'
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

    let prevSchedule = null
    let nextSchedule = null

    if (schedule) {
      // 이전 달의 DEPLOYED 스케줄 조회 (캘린더 시작 ~ 현재 월 끝까지)
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
                lte: monthEnd
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

      // 다음 달의 DEPLOYED 스케줄 조회
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

    // 연차/오프 신청 조회 (캘린더 전체 범위)
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: {
          gte: calendarStart,
          lte: calendarEnd
        }
      },
      include: {
        staff: true
      }
    })

    // 공휴일 조회
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

    // 공휴일 맵 생성
    const holidayMap = new Map<string, string>()
    holidays.forEach(holiday => {
      const dateKey = new Date(holiday.date).toISOString().split('T')[0]
      holidayMap.set(dateKey, holiday.name)
    })

    // 의사 조합 정보 조회
    const combinations = await prisma.doctorCombination.findMany({
      where: { clinicId }
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

    console.log(`📅 공개 스케줄: ${year}년 ${month}월`)
    console.log(`  현재월 원장: ${currentDoctors.length}, 직원: ${currentStaff.length}`)
    console.log(`  이전월 원장: ${prevDoctors.length}, 직원: ${prevStaff.length}`)
    console.log(`  다음월 원장: ${nextDoctors.length}, 직원: ${nextStaff.length}`)
    console.log(`  전체 원장: ${allDoctors.length}, 직원: ${allStaffAssignments.length}`)

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

    // 날짜별 데이터 배열 생성
    const daysArray: any[] = []

    doctorsByDate.forEach((doctorSchedules, dateKey) => {
      const doctorShortNames = doctorSchedules.map(ds => ds.doctor.shortName)
      const hasNightShift = doctorSchedules.some(ds => ds.hasNightShift)

      // 의사 조합 찾기
      const combination = combinations.find(c => {
        const comboDoctors = (c.doctors as string[]).sort()
        return JSON.stringify(comboDoctors) === JSON.stringify(doctorShortNames.sort()) &&
               c.hasNightShift === hasNightShift
      })

      const combinationName = combination?.name || doctorShortNames.join(', ')

      // 직원 배정
      const dayStaff = staffByDate.get(dateKey) || []

      // 연차 신청
      const dayLeaves = leaves.filter(
        l => new Date(l.date).toISOString().split('T')[0] === dateKey
      )

      // 직원 배정을 assignments 형식으로 변환 (StaffAssignment 기준)
      const assignments: any[] = []
      const assignedStaffIds = new Set<string>()

      // StaffAssignment를 LeaveApplication과 매핑
      dayStaff.forEach(staff => {
        assignedStaffIds.add(staff.staffId)
        const leaveInfo = dayLeaves.find(l =>
          l.staffId === staff.staffId &&
          (l.status === 'CONFIRMED' || l.status === 'ON_HOLD')
        )

        // 연차/오프 타입 결정
        let leaveType: 'ANNUAL' | 'OFF' | null = null
        if (staff.shiftType === 'OFF') {
          // OFF 중에서 연차인지 확인
          if (leaveInfo && leaveInfo.leaveType === 'ANNUAL') {
            leaveType = 'ANNUAL'
          } else {
            leaveType = 'OFF'
          }
        }

        // shiftType이 NIGHT이면 hasNightShift = true
        const hasStaffNightShift = staff.shiftType === 'NIGHT'

        assignments.push({
          staff: {
            id: staff.staff.id,
            name: staff.staff.name,
            rank: staff.staff.rank || staff.staff.departmentName
          },
          hasNightShift: hasStaffNightShift,
          leaveType,
          leaveStatus: leaveInfo?.status || null
        })
      })

      // ANNUAL은 StaffAssignment에 없을 수 있으므로 LeaveApplication에서 직접 추가
      dayLeaves.forEach(leave => {
        if (
          leave.leaveType === 'ANNUAL' &&
          (leave.status === 'CONFIRMED' || leave.status === 'ON_HOLD') &&
          !assignedStaffIds.has(leave.staffId)
        ) {
          assignments.push({
            staff: {
              id: leave.staff.id,
              name: leave.staff.name,
              rank: leave.staff.rank || leave.staff.departmentName
            },
            hasNightShift: false,
            leaveType: 'ANNUAL',
            leaveStatus: leave.status
          })
        }
      })

      const date = new Date(dateKey)
      daysArray.push({
        date: dateKey,
        dayOfWeek: date.getDay(),
        isHoliday: holidayMap.has(dateKey),
        holidayName: holidayMap.get(dateKey) || null,
        combinationName,
        hasNightShift,
        assignments
      })
    })

    // 의사 스케줄이 없는 공휴일도 추가
    holidayMap.forEach((holidayName, dateKey) => {
      if (!doctorsByDate.has(dateKey)) {
        const date = new Date(dateKey)
        daysArray.push({
          date: dateKey,
          dayOfWeek: date.getDay(),
          isHoliday: true,
          holidayName,
          combinationName: null,
          hasNightShift: false,
          assignments: []
        })
      }
    })

    // 날짜순 정렬
    daysArray.sort((a, b) => a.date.localeCompare(b.date))

    console.log(`📊 최종 날짜 데이터: ${daysArray.length}일`)

    // 현재 월에 속하는 날짜만 필터링하여 통계 계산
    const currentMonthStart = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const currentMonthEnd = new Date(year, month, 0).toISOString().split('T')[0]

    const currentMonthDays = daysArray.filter(day =>
      day.date >= currentMonthStart && day.date <= currentMonthEnd
    )

    return NextResponse.json({
      success: true,
      data: {
        year,
        month,
        clinicName: link.clinic.name,
        days: daysArray,
        statistics: {
          totalDays: currentMonthDays.length,
          staffCount: schedule ? await prisma.staff.count({
            where: {
              clinicId,
              isActive: true,
              departmentName: '진료실'
            }
          }) : 0
        }
      }
    })
  } catch (error: any) {
    console.error('스케줄 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '스케줄 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
