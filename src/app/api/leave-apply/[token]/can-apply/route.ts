/**
 * 공개 연차/오프 신청 - 날짜별 신청 가능 여부 체크 API
 * GET /api/leave-apply/[token]/can-apply?staffId=xxx&date=YYYY-MM-DD&type=OFF|ANNUAL
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { simulateScheduleWithLeave } from '@/lib/services/leave-eligibility-simulator'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const staffId = searchParams.get('staffId')
    const dateStr = searchParams.get('date')
    const type = searchParams.get('type') as 'ANNUAL' | 'OFF' | null
    const existingOffsInWeekParam = searchParams.get('existingOffsInWeek')
    const existingOffsInWeek = existingOffsInWeekParam ? existingOffsInWeekParam.split(',') : []

    // 선택 중인 모든 OFF 날짜들 (형평성 체크용)
    const pendingSelectionsParam = searchParams.get('pendingSelections')
    const pendingSelections = pendingSelectionsParam
      ? pendingSelectionsParam.split(',').map(d => new Date(d))
      : []

    if (!staffId || !dateStr || !type) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다' },
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
        fairnessScoreTotalDays: true,
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

    const requestDate = new Date(dateStr)
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

    // 실제 신청 가능 기간 계산
    let applicationStartDate = leavePeriod?.startDate
    let applicationEndDate = leavePeriod?.endDate

    if (leavePeriod) {
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
    }

    console.log('🔍 [API can-apply] 시뮬레이션 요청:', {
      staffId,
      staffName: staff.name,
      dateStr,
      type,
      year,
      month,
      applicationStartDate,
      applicationEndDate
    })

    // 시뮬레이션을 통한 검증 (주4일, 구분별 인원, 형평성 등 모든 제약 조건 체크)
    const simulation = await simulateScheduleWithLeave({
      clinicId: link.clinicId,
      staffId,
      leaveDate: requestDate,
      leaveType: type,
      year,
      month,
      existingOffsInWeek: existingOffsInWeek.length > 0 ? existingOffsInWeek : undefined,
      pendingSelections: pendingSelections.length > 0 ? pendingSelections : undefined,
      applicationStartDate,
      applicationEndDate,
    })

    console.log('🔍 [API can-apply] 시뮬레이션 결과:', simulation)

    if (!simulation.feasible) {
      return NextResponse.json({
        success: false,
        canApply: false,
        reason: simulation.reason,
        message: simulation.userFriendlyMessage || '해당 날짜에 신청할 수 없습니다',
        technicalReason: simulation.technicalReason,
        details: simulation.details,
      })
    }

    // 1. 연차인 경우: 연차 잔여 일수 추가 체크
    if (type === 'ANNUAL') {
      const remainingAnnual = staff.totalAnnualDays - staff.usedAnnualDays

      // 이미 신청한 연차 수 (해당 월)
      const appliedAnnualCount = await prisma.leaveApplication.count({
        where: {
          staffId: staff.id,
          linkId: link.id,
          leaveType: 'ANNUAL',
          status: 'CONFIRMED',
        }
      })

      if (remainingAnnual - appliedAnnualCount <= 0) {
        return NextResponse.json({
          success: false,
          canApply: false,
          reason: 'ANNUAL_EXHAUSTED',
          message: '연차 잔여 일수가 부족합니다',
          details: {
            total: staff.totalAnnualDays,
            used: staff.usedAnnualDays,
            applied: appliedAnnualCount,
            remaining: remainingAnnual - appliedAnnualCount,
          }
        })
      }
    }

    // 2. 오프인 경우: 형평성 기반 필터 적용
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)

    // 정기 휴무일 설정 조회
    const closedDaySettings = await prisma.closedDaySettings.findUnique({
      where: { clinicId: link.clinicId },
      select: { regularDays: true }
    })
    const regularClosedDays = (closedDaySettings?.regularDays as number[]) || [0]

    // 해당 월 총 근무일 계산
    let workingDays = 0
    for (let day = 1; day <= monthEnd.getDate(); day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay()
      if (!regularClosedDays.includes(dayOfWeek)) {
        workingDays++
      }
    }

    // 같은 부서 전체 직원의 누적 형평성 편차 평균 계산
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        isActive: true,
        departmentName: staff.departmentName
      },
      select: {
        id: true,
        fairnessScoreTotalDays: true,
      }
    })

    let totalDeviation = 0
    let staffCount = 0
    for (const s of allStaff) {
      if (s.fairnessScoreTotalDays !== null) {
        totalDeviation += s.fairnessScoreTotalDays
        staffCount++
      }
    }

    const avgFairnessScore = staffCount > 0 ? totalDeviation / staffCount : 0
    const myFairnessScore = staff.fairnessScoreTotalDays || 0
    const scoreDifference = myFairnessScore - avgFairnessScore

    const baseAllowance = Math.floor(workingDays * 0.3) // 기본 30%
    const fairnessBonus = Math.floor(scoreDifference / 2) // 점수 2점 차이마다 1일 추가
    const maxAllowedDays = Math.max(0, baseAllowance + fairnessBonus)

    // 이미 신청한 오프 일수 계산
    const appliedOffs = await prisma.leaveApplication.count({
      where: {
        staffId: staff.id,
        linkId: link.id,
        leaveType: 'OFF',
        status: 'CONFIRMED',
        date: {
          gte: monthStart,
          lte: monthEnd,
        }
      }
    })

    const remainingDays = Math.max(0, maxAllowedDays - appliedOffs)

    if (remainingDays <= 0) {
      return NextResponse.json({
        success: false,
        canApply: false,
        reason: 'FAIRNESS_LIMIT',
        message: `${month}월 오프 신청 가능 일수를 모두 사용하셨습니다`,
        details: {
          workingDays,
          maxAllowedDays,
          appliedOffs,
          remainingDays: 0,
          myFairnessScore,
          avgFairnessScore: Math.round(avgFairnessScore * 10) / 10,
          scoreDifference: Math.round(scoreDifference * 10) / 10,
        }
      })
    }

    return NextResponse.json({
      success: true,
      canApply: true,
      reason: 'OK',
      message: `신청 가능합니다 (남은 오프: ${remainingDays}일)`,
      details: {
        workingDays,
        maxAllowedDays,
        appliedOffs,
        remainingDays,
        myFairnessScore,
        avgFairnessScore: Math.round(avgFairnessScore * 10) / 10,
        scoreDifference: Math.round(scoreDifference * 10) / 10,
      }
    })

  } catch (error: any) {
    console.error('신청 가능 여부 체크 오류:', error)
    return NextResponse.json(
      { success: false, error: '신청 가능 여부를 확인하는데 실패했습니다' },
      { status: 500 }
    )
  }
}
