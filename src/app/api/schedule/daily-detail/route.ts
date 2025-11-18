/**
 * 일별 스케줄 상세 API
 * GET /api/schedule/daily-detail?date=2025-01-15
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')
    const statusParam = searchParams.get('status') // 'DRAFT', 'CONFIRMED', 'DEPLOYED'
    const departmentType = searchParams.get('departmentType') // 'auto' | 'manual' | null

    if (!dateStr) {
      return NextResponse.json({ success: false, error: 'Date required' }, { status: 400 })
    }

    const date = new Date(dateStr)
    const dateYear = date.getFullYear()
    const dateMonth = date.getMonth() + 1
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

    // **의사 스케줄 기준으로 조회**
    // 해당 날짜에 의사가 배정된 스케줄을 찾기 (월 상관없이)
    const doctorSchedule = await prisma.scheduleDoctor.findFirst({
      where: {
        schedule: {
          clinicId
        },
        date: new Date(dateStr)
      },
      include: {
        schedule: true
      }
    })

    let schedule = doctorSchedule?.schedule || null

    // 의사 스케줄이 없으면 현재 월 스케줄 찾기 (fallback)
    if (!schedule) {
      if (statusParam) {
        schedule = await prisma.schedule.findFirst({
          where: {
            clinicId,
            year: dateYear,
            month: dateMonth,
            status: statusParam as any
          }
        })
      } else {
        const deployedSchedule = await prisma.schedule.findFirst({
          where: {
            clinicId,
            year: dateYear,
            month: dateMonth,
            status: 'DEPLOYED'
          }
        })

        schedule = deployedSchedule || await prisma.schedule.findFirst({
          where: {
            clinicId,
            year: dateYear,
            month: dateMonth,
            status: 'DRAFT'
          }
        })
      }
    }

    // 공휴일 확인
    const holiday = await prisma.holiday.findFirst({
      where: {
        clinicId,
        date: new Date(dateStr)
      }
    })

    // 원장 스케줄 조회
    const doctors = schedule ? await prisma.scheduleDoctor.findMany({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateStr)
      },
      include: {
        doctor: true
      }
    }) : []

    // 직원 배정 조회 (Department, StaffCategory 포함)
    const staffAssignments = schedule ? await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateStr),
        ...(departmentNames ? {
          staff: {
            departmentName: { in: departmentNames }
          }
        } : {})
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            departmentName: true,
            categoryName: true,
            rank: true
          }
        },
        substituteForStaff: {
          select: {
            id: true,
            name: true,
            departmentName: true,
            rank: true
          }
        }
      }
    }) : []

    // 연차/오프 신청 조회
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: new Date(dateStr),
        ...(departmentNames ? {
          staff: {
            departmentName: { in: departmentNames }
          }
        } : {})
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            departmentName: true,
            categoryName: true,
            rank: true
          }
        }
      }
    })

    // 의사 조합 정보
    const doctorList = doctors.map(d => ({
      id: d.doctor.id,
      name: d.doctor.name,
      hasNightShift: d.hasNightShift
    }))

    // Department와 StaffCategory 정보 가져오기 (order 필드용)
    const departments = await prisma.department.findMany({
      where: { clinicId },
      select: { name: true, order: true }
    })
    const departmentOrderMap = new Map(departments.map(d => [d.name, d.order]))

    const staffCategories = await prisma.staffCategory.findMany({
      where: { clinicId },
      select: { name: true, order: true }
    })
    const categoryOrderMap = new Map(staffCategories.map(c => [c.name, c.order]))

    // 직원 목록 생성 (StaffAssignment 기준)
    const staffList: Array<{
      id: string
      name: string
      rank: string
      categoryName?: string
      departmentName?: string
      departmentOrder?: number
      categoryOrder?: number
      isFlexible?: boolean
      originalCategory?: string
      assignedCategory?: string
      isAssigned: boolean
      leaveType?: 'ANNUAL' | 'OFF' | null
      leaveStatus?: string | null
    }> = []

    // StaffAssignment를 LeaveApplication과 매핑
    const assignedStaffIds = new Set<string>()
    staffAssignments.forEach(assignment => {
      assignedStaffIds.add(assignment.staffId)
      const leaveInfo = leaves.find(l =>
        l.staffId === assignment.staffId &&
        (l.status === 'CONFIRMED' || l.status === 'ON_HOLD')
      )

      // 연차/오프 타입 결정 (LeaveApplication 우선)
      let leaveType: 'ANNUAL' | 'OFF' | null = null
      if (leaveInfo && (leaveInfo.status === 'CONFIRMED' || leaveInfo.status === 'ON_HOLD')) {
        // LeaveApplication이 있으면 우선 적용 (데이터 불일치 대응)
        leaveType = leaveInfo.leaveType as 'ANNUAL' | 'OFF'
      } else if (assignment.shiftType === 'OFF') {
        // LeaveApplication 없는 OFF
        leaveType = 'OFF'
      }

      const departmentName = assignment.staff.departmentName || undefined
      const categoryName = assignment.staff.categoryName || undefined

      staffList.push({
        id: assignment.staff.id,
        name: assignment.staff.name,
        rank: assignment.staff.rank || '',
        categoryName,
        departmentName,
        departmentOrder: departmentName ? departmentOrderMap.get(departmentName) : undefined,
        categoryOrder: categoryName ? categoryOrderMap.get(categoryName) : undefined,
        isFlexible: assignment.isFlexible,
        originalCategory: assignment.originalCategory || undefined,
        assignedCategory: assignment.assignedCategory || undefined,
        isAssigned: true,
        leaveType,
        leaveStatus: leaveInfo?.status || null
      })
    })

    // ANNUAL은 StaffAssignment에 없을 수 있으므로 LeaveApplication에서 직접 추가
    leaves.forEach(leave => {
      if (
        leave.leaveType === 'ANNUAL' &&
        (leave.status === 'CONFIRMED' || leave.status === 'ON_HOLD') &&
        !assignedStaffIds.has(leave.staffId)
      ) {
        const departmentName = leave.staff.departmentName || undefined
        const categoryName = leave.staff.categoryName || undefined

        staffList.push({
          id: leave.staff.id,
          name: leave.staff.name,
          rank: leave.staff.rank || '',
          categoryName,
          departmentName,
          departmentOrder: departmentName ? departmentOrderMap.get(departmentName) : undefined,
          categoryOrder: categoryName ? categoryOrderMap.get(categoryName) : undefined,
          isAssigned: true,
          leaveType: 'ANNUAL',
          leaveStatus: leave.status
        })
      }
    })

    // 근무/연차/오프 분리
    const workingStaff = staffList.filter(s => !s.leaveType)
    const annualLeaveStaff = staffList.filter(s => s.leaveType === 'ANNUAL')
    const offDaysStaff = staffList.filter(s => s.leaveType === 'OFF')

    // 연차/오프 목록
    const leavesList = staffList
      .filter(s => s.leaveType && (s.leaveStatus === 'CONFIRMED' || s.leaveStatus === 'ON_HOLD'))
      .map(s => ({
        staffId: s.id,
        staffName: s.name,
        type: s.leaveType!,
        status: s.leaveStatus!
      }))

    // isNightShift 계산 (하나라도 야간 근무면 true)
    const isNightShift = doctorList.some(d => d.hasNightShift)

    return NextResponse.json({
      success: true,
      data: {
        id: schedule?.id,
        date: dateStr,
        doctors: doctorList.map(d => ({ id: d.id, name: d.name })),
        staff: workingStaff,
        annualLeave: annualLeaveStaff,
        offDays: offDaysStaff,
        leaves: leavesList,
        isNightShift,
        isHoliday: !!holiday,
        holidayName: holiday?.name
      }
    })
  } catch (error) {
    console.error('Error fetching daily detail:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
