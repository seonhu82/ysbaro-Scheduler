/**
 * 내 형평성 점수 API
 * GET: 직원의 월별 형평성 점수 조회
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
        { success: false, error: '직원 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // 토큰으로 링크 조회
    const link = await prisma.scheduleViewLink.findUnique({
      where: { token: params.token }
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

    // 직원 확인
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        clinicId: link.clinicId,
        isActive: true
      }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 최근 6개월 배포된 스케줄 조회
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const currentDate = new Date()

    const schedules = await prisma.schedule.findMany({
      where: {
        clinicId: link.clinicId,
        status: 'DEPLOYED',
        OR: [
          {
            year: { gte: sixMonthsAgo.getFullYear() },
            month: { gte: sixMonthsAgo.getMonth() + 1 }
          },
          {
            year: { lte: currentDate.getFullYear() },
            month: { lte: currentDate.getMonth() + 1 }
          }
        ]
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    })

    const fairnessData = []

    for (const schedule of schedules) {
      // 해당 월의 직원 배치 조회
      const startDate = new Date(schedule.year, schedule.month - 1, 1)
      const endDate = new Date(schedule.year, schedule.month, 0)

      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          staffId,
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      })

      // 연차 신청 조회
      const annualLeaves = await prisma.leaveApplication.findMany({
        where: {
          staffId,
          clinicId: link.clinicId,
          leaveType: 'ANNUAL',
          status: {
            in: ['CONFIRMED', 'ON_HOLD']
          },
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      })

      // 근무일, 오프일 계산
      const totalWorkDays = assignments.filter(a => a.shiftType !== 'OFF').length
      const totalOffDays = assignments.filter(a => a.shiftType === 'OFF').length
      const annualLeaveDays = annualLeaves.length

      // 형평성 점수 계산 (근무일 - 오프일)
      const fairnessScore = totalWorkDays - totalOffDays

      // 부서 평균 계산
      const departmentAssignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          date: {
            gte: startDate,
            lte: endDate
          },
          staff: {
            departmentName: staff.departmentName,
            isActive: true
          }
        },
        include: {
          staff: true
        }
      })

      // 직원별로 그룹화하여 평균 계산
      const staffScores = new Map<string, number>()
      for (const assignment of departmentAssignments) {
        if (!staffScores.has(assignment.staffId)) {
          staffScores.set(assignment.staffId, 0)
        }
        const currentScore = staffScores.get(assignment.staffId)!
        if (assignment.shiftType === 'OFF') {
          staffScores.set(assignment.staffId, currentScore - 1)
        } else {
          staffScores.set(assignment.staffId, currentScore + 1)
        }
      }

      const scores = Array.from(staffScores.values())
      const averageScore = scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0

      fairnessData.push({
        year: schedule.year,
        month: schedule.month,
        totalWorkDays,
        totalOffDays,
        annualLeaveDays,
        fairnessScore,
        averageScore
      })
    }

    return NextResponse.json({
      success: true,
      data: fairnessData
    })
  } catch (error: any) {
    console.error('형평성 점수 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '형평성 점수 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
