/**
 * 날짜별 스케줄 조회 API
 * GET: 특정 날짜의 스케줄 데이터 (원장, 직원 배치)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const statusParam = searchParams.get('status') // DRAFT or DEPLOYED

    if (!dateParam) {
      return badRequestResponse('Date parameter is required')
    }

    const clinicId = session.user.clinicId
    // 시간대 문제 해결: dateParam을 직접 Date 객체로 생성
    const dateOnly = new Date(dateParam + 'T00:00:00.000Z')

    // Schedule 조건 구성
    const scheduleWhere: any = { clinicId }

    // year/month가 제공되면 특정 스케줄만 조회
    if (yearParam && monthParam) {
      scheduleWhere.year = parseInt(yearParam)
      scheduleWhere.month = parseInt(monthParam)
    }

    // status가 제공되면 해당 상태만 조회 (DRAFT or DEPLOYED)
    if (statusParam) {
      scheduleWhere.status = statusParam
    } else {
      // status 미지정 시 DRAFT와 DEPLOYED 모두 조회
      scheduleWhere.status = { in: ['DRAFT', 'DEPLOYED'] }
    }

    // 1. ScheduleDoctor 조회 (해당 날짜의 원장 스케줄)
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date: dateOnly,
        schedule: scheduleWhere
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        }
      }
    })

    // 2. StaffAssignment 조회 (해당 날짜의 직원 배치)
    const staffAssignments = await prisma.staffAssignment.findMany({
      where: {
        date: dateOnly,
        schedule: scheduleWhere
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            categoryName: true
          }
        }
      }
    })

    // 3. LeaveApplication 조회 (해당 날짜의 연차/오프 신청)
    console.log('Querying leave applications for date:', dateOnly)
    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: dateOnly,
        status: 'CONFIRMED'
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            categoryName: true
          }
        }
      }
    })
    console.log('Found leave applications:', leaveApplications.length)

    // 데이터가 없으면 빈 스케줄 반환
    if (doctorSchedules.length === 0 && staffAssignments.length === 0 && leaveApplications.length === 0) {
      return successResponse({
        date: dateParam,
        doctors: [],
        staff: [],
        annualLeave: [],
        offDays: [],
        isNightShift: false,
        isEmpty: true
      })
    }

    // 연차와 수동 오프 구분
    const annualLeave = leaveApplications
      .filter(la => la.leaveType === 'ANNUAL')
      .map(la => ({
        id: la.staff.id,
        name: la.staff.name,
        rank: la.staff.rank,
        categoryName: la.staff.categoryName
      }))

    const manualOffDays = leaveApplications
      .filter(la => la.leaveType === 'OFF')
      .map(la => ({
        id: la.staff.id,
        name: la.staff.name,
        rank: la.staff.rank,
        categoryName: la.staff.categoryName
      }))

    // 4. 자동 오프 계산: 전체 활성 직원 - 근무 직원 - 연차 직원 - 수동 오프 직원
    const allActiveStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      },
      select: {
        id: true,
        name: true,
        rank: true,
        categoryName: true
      }
    })

    // 근무 직원 ID 목록
    const workingStaffIds = new Set(staffAssignments.map(sa => sa.staff.id))
    // 연차/수동 오프 직원 ID 목록
    const leaveStaffIds = new Set(leaveApplications.map(la => la.staff.id))

    // 자동 오프 = 전체 - 근무 - 연차/수동오프
    const autoOffDays = allActiveStaff
      .filter(staff => !workingStaffIds.has(staff.id) && !leaveStaffIds.has(staff.id))
      .map(staff => ({
        id: staff.id,
        name: staff.name,
        rank: staff.rank,
        categoryName: staff.categoryName
      }))

    // 모든 오프 = 수동 오프 + 자동 오프
    const allOffDays = [...manualOffDays, ...autoOffDays]

    // 응답 데이터 구성
    const responseData = {
      date: dateParam,
      doctors: doctorSchedules.map(ds => ({
        id: ds.doctor.id,
        name: ds.doctor.name
      })),
      staff: staffAssignments.map(sa => ({
        id: sa.staff.id,
        name: sa.staff.name,
        rank: sa.staff.rank,
        categoryName: sa.staff.categoryName
      })),
      annualLeave,
      offDays: allOffDays, // 수동 오프 + 자동 오프
      isNightShift: doctorSchedules.some(ds => ds.hasNightShift),
      isEmpty: false
    }

    return successResponse(responseData)
  } catch (error) {
    console.error('Get day schedule error:', error)
    return errorResponse('Failed to fetch day schedule', 500)
  }
}
