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

    if (!dateStr) {
      return NextResponse.json({ success: false, error: 'Date required' }, { status: 400 })
    }

    const date = new Date(dateStr)
    const dateYear = date.getFullYear()
    const dateMonth = date.getMonth() + 1
    const clinicId = (session.user as any).clinicId

    // 스케줄 조회: date의 year/month를 기준으로 조회 (파라미터 무시)
    let schedule = null
    if (statusParam) {
      // status 파라미터가 있으면 해당 status만 조회
      schedule = await prisma.schedule.findFirst({
        where: {
          clinicId,
          year: dateYear,
          month: dateMonth,
          status: statusParam as any
        }
      })
    } else {
      // status 파라미터가 없으면 DEPLOYED 우선, 없으면 DRAFT
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

    // 직원 배정 조회
    const staffAssignments = schedule ? await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        date: new Date(dateStr)
      },
      include: {
        staff: {
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
        date: new Date(dateStr)
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            departmentName: true,
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

    // 직원 목록 생성 (StaffAssignment 기준)
    const staffList: Array<{
      id: string
      name: string
      category: string
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

      staffList.push({
        id: assignment.staff.id,
        name: assignment.staff.name,
        category: assignment.staff.departmentName || '미분류',
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
        staffList.push({
          id: leave.staff.id,
          name: leave.staff.name,
          category: leave.staff.departmentName || '미분류',
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

    return NextResponse.json({
      success: true,
      data: {
        date: dateStr,
        doctors: doctorList,
        staff: workingStaff,
        annualLeave: annualLeaveStaff,
        offDays: offDaysStaff,
        leaves: leavesList,
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
