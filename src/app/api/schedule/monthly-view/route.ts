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
    const departmentType = searchParams.get('departmentType') // 'auto' | 'manual' | null

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Invalid year or month' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    // 부서 필터링
    let departmentNames: string[] | undefined = undefined
    if (departmentType === 'auto' || departmentType === 'manual') {
      const departments = await prisma.department.findMany({
        where: {
          clinicId,
          useAutoAssignment: departmentType === 'auto'
        },
        select: { name: true }
      })
      departmentNames = departments.map(d => d.name)
    }

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

    // **의사 스케줄 기준으로 조회**
    // 캘린더 범위의 모든 의사 스케줄 조회
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        schedule: {
          clinicId,
          status: scheduleStatus as any
        },
        date: {
          gte: calendarStart,
          lte: calendarEnd
        }
      },
      include: {
        doctor: true,
        schedule: true
      }
    })

    // 의사 스케줄이 속한 Schedule ID들 수집
    const scheduleIds = [...new Set(doctorSchedules.map(ds => ds.scheduleId))]

    // 해당 Schedule들의 직원 배정 조회
    const staffAssignments = scheduleIds.length > 0 ? await prisma.staffAssignment.findMany({
      where: {
        scheduleId: { in: scheduleIds },
        date: {
          gte: calendarStart,
          lte: calendarEnd
        },
        ...(departmentNames ? {
          staff: {
            departmentName: { in: departmentNames }
          }
        } : {})
      },
      include: {
        staff: true,
        substituteForStaff: true
      }
    }) : []

    // 연차/오프 신청 조회 (캘린더 전체 범위)
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: {
          gte: calendarStart,
          lte: calendarEnd
        },
        ...(departmentNames ? {
          staff: {
            departmentName: { in: departmentNames }
          }
        } : {})
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

    // 의사 스케줄 기준으로 이미 조회했으므로 그대로 사용
    const allDoctors = doctorSchedules
    const allStaffAssignments = staffAssignments

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
      // 중복 제거 (같은 날짜에 여러 Schedule의 데이터가 있을 수 있음)
      const doctorShortNames = [...new Set(doctorSchedules.map(ds => ds.doctor.shortName))]
      const hasNightShift = doctorSchedules.some(ds => ds.hasNightShift)

      // 의사 조합 찾기
      const combination = combinations.find(c => {
        const comboDoctors = (c.doctors as string[]).sort()
        return JSON.stringify(comboDoctors) === JSON.stringify(doctorShortNames.sort()) &&
               c.hasNightShift === hasNightShift
      })

      const requiredStaff = (combination?.requiredStaff as number) || 0

      // StaffAssignment 기반 카운팅
      const dayStaff = staffByDate.get(dateKey) || []

      // 연차 신청 정보 로드
      const dayLeaves = leaves.filter(
        l => new Date(l.date).toISOString().split('T')[0] === dateKey
      )

      // StaffAssignment를 LeaveApplication과 매핑
      const staffMap = new Map()
      dayStaff.forEach(assignment => {
        const leave = dayLeaves.find(l =>
          l.staffId === assignment.staffId &&
          (l.status === 'CONFIRMED' || l.status === 'ON_HOLD')
        )
        staffMap.set(assignment.staffId, {
          assignment,
          leave
        })
      })

      // 카운트: StaffAssignment 기준으로 계산
      let assignedStaff = 0
      let annualLeaveCount = 0
      let offCount = 0

      staffMap.forEach(({ assignment, leave }) => {
        if (assignment.shiftType === 'OFF') {
          // OFF 중에서 연차인지 확인
          if (leave && leave.leaveType === 'ANNUAL') {
            annualLeaveCount++
          } else {
            offCount++
          }
        } else {
          // DAY, NIGHT
          assignedStaff++
        }
      })

      // 디버깅: OFF 카운트 로그
      if (offCount > 0) {
        console.log(`📊 ${dateKey}: OFF ${offCount}명, 배치 ${assignedStaff}명, 연차 ${annualLeaveCount}명`)
      }

      // ANNUAL은 StaffAssignment에 없을 수 있으므로 LeaveApplication에서 직접 카운트
      const annualOnlyStaff = dayLeaves.filter(leave =>
        leave.leaveType === 'ANNUAL' &&
        (leave.status === 'CONFIRMED' || leave.status === 'ON_HOLD') &&
        !staffMap.has(leave.staffId)
      )
      annualLeaveCount += annualOnlyStaff.length

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
      scheduleData,
      staffAssignments: allStaffAssignments.map(sa => ({
        id: sa.id,
        scheduleId: sa.scheduleId,
        staffId: sa.staffId,
        date: sa.date.toISOString(),
        shiftType: sa.shiftType
      }))
    })
  } catch (error) {
    console.error('Error fetching monthly view:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
