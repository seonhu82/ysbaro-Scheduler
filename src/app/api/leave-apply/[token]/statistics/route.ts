/**
 * 연차/오프 신청 통계 API
 * GET /api/leave-apply/[token]/statistics?staffId=xxx
 *
 * 목적: 직원의 신청 현황과 예상 OFF 일수를 보여주어
 *       과도한 신청을 방지하고 자동 배치 시스템 활용을 권장
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: 'staffId is required' },
        { status: 400 }
      )
    }

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

    // 직원 정보 조회
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        categoryName: true,
        departmentName: true,
      }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 자동배치 부서인지 확인
    if (staff.departmentName) {
      const department = await prisma.department.findFirst({
        where: {
          clinicId: link.clinicId,
          name: staff.departmentName
        }
      })

      if (!department || !department.useAutoAssignment) {
        return NextResponse.json(
          { success: false, error: '자동배치 사용 부서만 통계를 조회할 수 있습니다' },
          { status: 403 }
        )
      }
    }

    // 병원 설정 조회 (주간 영업일, 기본 근무일)
    const ruleSettings = await prisma.ruleSettings.findUnique({
      where: { clinicId: link.clinicId },
      select: {
        weekBusinessDays: true,
        defaultWorkDays: true,
      }
    })

    const weekBusinessDays = ruleSettings?.weekBusinessDays || 6
    const defaultWorkDays = ruleSettings?.defaultWorkDays || 4

    // 신청 가능 기간 조회
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

    if (lastDoctorSchedule?.date) {
      const doctorEndDate = new Date(lastDoctorSchedule.date)
      const leavePeriodEndDate = new Date(leavePeriod.endDate)
      if (doctorEndDate < leavePeriodEndDate) {
        applicationEndDate = doctorEndDate
      }
    }

    // 신청 가능 기간 내의 원장 스케줄 날짜만 조회 (중복 제거)
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        schedule: {
          clinicId: link.clinicId,
          year: link.year,
          month: link.month,
        },
        date: {
          gte: applicationStartDate,
          lte: applicationEndDate,
        }
      },
      select: {
        date: true,
      },
      distinct: ['date']
    })

    // 일요일 제외한 신청 가능 영업일 수 계산
    const totalBusinessDays = doctorSchedules.filter(ds => {
      const date = new Date(ds.date)
      return date.getDay() !== 0 // 일요일 제외
    }).length

    // 예상 OFF 일수 = (주간 영업일 - 기본 근무일) × (전체 영업일 / 주간 영업일)
    // 간단하게 = 전체 영업일 × (1 - 기본 근무일 / 주간 영업일)
    const expectedOffDays = Math.round(totalBusinessDays * (1 - defaultWorkDays / weekBusinessDays))

    // 현재 승인된 신청 건수 (CONFIRMED + PENDING)
    const confirmedApplications = await prisma.leaveApplication.findMany({
      where: {
        staffId,
        clinicId: link.clinicId,
        date: {
          gte: new Date(link.year, link.month - 1, 1),
          lt: new Date(link.year, link.month, 1),
        },
        status: {
          in: ['CONFIRMED', 'PENDING']
        }
      },
      select: {
        id: true,
        date: true,
        leaveType: true,
        status: true,
      }
    })

    const currentApprovedCount = confirmedApplications.length
    const remainingAutoOff = Math.max(0, expectedOffDays - currentApprovedCount)

    // 신청 비율 계산
    const applicationRatio = expectedOffDays > 0
      ? Math.round((currentApprovedCount / expectedOffDays) * 100)
      : 0

    // 권장 최대 신청 수 (예상 OFF의 30% 정도만 신청하는 것을 권장)
    const recommendedMaxApplications = Math.ceil(expectedOffDays * 0.3)

    // 가이드라인 상태 결정
    let guidelineStatus: 'good' | 'warning' | 'critical' = 'good'
    let guidelineMessage = ''

    if (currentApprovedCount === 0) {
      guidelineStatus = 'good'
      guidelineMessage = '아직 신청하신 내역이 없습니다. 꼭 필요한 날짜만 신청해주세요.'
    } else if (currentApprovedCount <= recommendedMaxApplications) {
      guidelineStatus = 'good'
      guidelineMessage = '적절한 신청 수준입니다. 나머지는 자동 배치가 형평성 있게 배분합니다.'
    } else if (currentApprovedCount <= expectedOffDays * 0.6) {
      guidelineStatus = 'warning'
      guidelineMessage = `신청이 다소 많습니다 (${currentApprovedCount}/${expectedOffDays}일). 자동 배치의 유연성이 감소할 수 있습니다.`
    } else {
      guidelineStatus = 'critical'
      guidelineMessage = `신청이 매우 많습니다 (${currentApprovedCount}/${expectedOffDays}일). 전체 스케줄 생성에 문제가 발생할 수 있습니다.`
    }

    return NextResponse.json({
      success: true,
      data: {
        staffName: staff.name,
        categoryName: staff.categoryName,
        totalBusinessDays,
        expectedOffDays,
        currentApprovedCount,
        remainingAutoOff,
        applicationRatio,
        recommendedMaxApplications,
        guidelines: {
          status: guidelineStatus,
          message: guidelineMessage,
        },
        applicationDetails: confirmedApplications.map(app => ({
          date: app.date.toISOString().split('T')[0],
          type: app.leaveType,
          status: app.status,
        }))
      }
    })

  } catch (error: any) {
    console.error('통계 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '통계 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
