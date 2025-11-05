/**
 * 연차/오프 신청 가능 기간 조회 API
 * GET /api/leave-apply/[token]/period
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // 해당 월의 LeavePeriod 조회
    const leavePeriod = await prisma.leavePeriod.findFirst({
      where: {
        clinicId: link.clinicId,
        year: link.year,
        month: link.month,
        isActive: true,
      },
    })

    if (!leavePeriod) {
      return NextResponse.json(
        {
          success: false,
          error: '연차/오프 신청 기간이 설정되지 않았습니다'
        },
        { status: 404 }
      )
    }

    // 실제로 생성된 직원 배치 확인
    const lastStaffAssignment = await prisma.staffAssignment.findFirst({
      where: {
        schedule: {
          clinicId: link.clinicId,
        },
      },
      orderBy: {
        date: 'desc',
      },
      select: {
        date: true,
      },
    })

    // 실제로 생성된 원장 스케줄 확인
    const lastDoctorSchedule = await prisma.scheduleDoctor.findFirst({
      where: {
        schedule: {
          clinicId: link.clinicId,
        },
      },
      orderBy: {
        date: 'desc',
      },
      select: {
        date: true,
      },
    })

    // 시작일 계산: StaffAssignment 최종일 + 1일
    let actualStartDate = leavePeriod.startDate
    if (lastStaffAssignment?.date) {
      const nextDay = new Date(lastStaffAssignment.date)
      nextDay.setDate(nextDay.getDate() + 1)

      // StaffAssignment 다음날과 LeavePeriod 시작일 중 더 늦은 날짜 선택
      if (nextDay > new Date(leavePeriod.startDate)) {
        actualStartDate = nextDay
      }
    }

    // 종료일 계산: min(ScheduleDoctor 최종일, LeavePeriod 종료일)
    let actualEndDate = leavePeriod.endDate
    if (lastDoctorSchedule?.date) {
      const doctorEndDate = new Date(lastDoctorSchedule.date)
      const leavePeriodEndDate = new Date(leavePeriod.endDate)

      if (doctorEndDate < leavePeriodEndDate) {
        actualEndDate = doctorEndDate
      }
    }

    console.log('📅 신청 가능 기간 계산:', {
      leavePeriodStart: leavePeriod.startDate,
      leavePeriodEnd: leavePeriod.endDate,
      lastStaffAssignmentDate: lastStaffAssignment?.date,
      lastDoctorScheduleDate: lastDoctorSchedule?.date,
      calculatedStartDate: actualStartDate,
      calculatedEndDate: actualEndDate,
    })

    return NextResponse.json({
      success: true,
      data: {
        year: leavePeriod.year,
        month: leavePeriod.month,
        startDate: actualStartDate,
        endDate: actualEndDate,
        maxSlots: leavePeriod.maxSlots,
        categorySlots: leavePeriod.categorySlots,
        lastStaffAssignmentDate: lastStaffAssignment?.date || null,
        lastDoctorScheduleDate: lastDoctorSchedule?.date || null,
      }
    })
  } catch (error: any) {
    console.error('신청 기간 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '신청 기간 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
