/**
 * 월간 캘린더 뷰 데이터 API
 * GET /api/schedule/monthly-view?year=2025&month=1
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns'

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
    // status='DEPLOYED'면 DEPLOYED만 조회
    const scheduleStatus = statusParam || 'DEPLOYED'

    // 스케줄 조회 (새 스키마: doctors, staffAssignments)
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month,
        status: scheduleStatus
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

    // 의사 조합 정보 조회
    const combinations = await prisma.doctorCombination.findMany({
      where: { clinicId }
    })

    // 전체 활성 직원 수 조회 (오프 계산용)
    const totalActiveStaff = await prisma.staff.count({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실' // 진료실 직원만
      }
    })

    // 날짜별로 의사 스케줄 그룹화
    const doctorsByDate = new Map<string, typeof schedule.doctors>()
    if (schedule) {
      for (const doctorSchedule of schedule.doctors) {
        const dateKey = new Date(doctorSchedule.date).toISOString().split('T')[0]
        if (!doctorsByDate.has(dateKey)) {
          doctorsByDate.set(dateKey, [])
        }
        doctorsByDate.get(dateKey)!.push(doctorSchedule)
      }
    }

    // 날짜별로 직원 배정 그룹화
    const staffByDate = new Map<string, typeof schedule.staffAssignments>()
    if (schedule) {
      for (const staffAssignment of schedule.staffAssignments) {
        const dateKey = new Date(staffAssignment.date).toISOString().split('T')[0]
        if (!staffByDate.has(dateKey)) {
          staffByDate.set(dateKey, [])
        }
        staffByDate.get(dateKey)!.push(staffAssignment)
      }
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
        offCount // 오프 인원
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
