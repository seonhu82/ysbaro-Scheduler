/**
 * 공개 연차/오프 신청 - 형평성 정보 API
 * GET /api/leave-apply/[token]/fairness?staffId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: '직원 ID가 필요합니다' },
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

    // 직원 정보 조회
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        clinicId: link.clinicId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        fairnessScoreTotalDays: true,
        fairnessScoreNight: true,
        fairnessScoreWeekend: true,
        fairnessScoreHoliday: true,
        fairnessScoreHolidayAdjacent: true,
      }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 형평성 설정 조회
    const fairnessSettings = await prisma.fairnessSettings.findUnique({
      where: { clinicId: link.clinicId }
    })

    // 신청 기간 계산
    const year = link.year
    const month = link.month

    // 11월 총 근무일 계산 (주말 제외)
    let workingDays = 0
    for (let day = 1; day <= new Date(year, month, 0).getDate(); day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++
      }
    }

    // 같은 부서 전체 직원의 형평성 점수 조회
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        isActive: true,
        departmentName: staff.departmentName
      },
      select: {
        fairnessScoreTotalDays: true,
      }
    })

    const avgFairnessScore = allStaff.length > 0
      ? allStaff.reduce((sum, s) => sum + (s.fairnessScoreTotalDays || 0), 0) / allStaff.length
      : 0

    // Staff 테이블의 형평성 점수 사용 (기준일 - 실제근무일)
    // 점수가 높을수록 덜 일한 것 = 더 많이 신청 가능
    const myFairnessScore = staff.fairnessScoreTotalDays || 0
    const scoreDifference = myFairnessScore - avgFairnessScore // 내 점수 - 평균 점수

    const baseAllowance = Math.floor(workingDays * 0.3) // 기본 30%
    const fairnessBonus = Math.floor(scoreDifference / 2) // 점수 2점 차이마다 1일 추가
    const maxAllowedDays = Math.max(0, baseAllowance + fairnessBonus)

    // 11월 마지막 날
    const lastDayOfMonth = new Date(year, month, 0).getDate()

    // 이미 신청한 오프 일수 계산
    const appliedOffs = await prisma.leaveApplication.count({
      where: {
        staffId: staff.id,
        linkId: link.id,
        status: 'CONFIRMED',
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month - 1, lastDayOfMonth),
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        staffName: staff.name,
        targetMonth: `누적`,
        fairnessScores: {
          totalDays: staff.fairnessScoreTotalDays || 0,
          night: staff.fairnessScoreNight || 0,
          weekend: staff.fairnessScoreWeekend || 0,
          holiday: staff.fairnessScoreHoliday || 0,
          holidayAdjacent: staff.fairnessScoreHolidayAdjacent || 0,
        },
        monthlyStats: {
          workingDays,
          appliedOffs,
          maxAllowedDays,
          remainingDays: Math.max(0, maxAllowedDays - appliedOffs),
          avgFairnessScore: Math.round(avgFairnessScore * 10) / 10, // 소수점 1자리
          myFairnessScore,
        },
        fairnessSettings: fairnessSettings ? {
          enableNightShift: fairnessSettings.enableNightShiftFairness,
          enableWeekend: fairnessSettings.enableWeekendFairness,
          enableHoliday: fairnessSettings.enableHolidayFairness,
          enableHolidayAdjacent: fairnessSettings.enableHolidayAdjacentFairness,
        } : null,
      }
    })
  } catch (error: any) {
    console.error('형평성 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '형평성 정보를 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
