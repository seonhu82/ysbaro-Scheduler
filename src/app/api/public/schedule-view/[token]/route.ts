/**
 * 공개 스케줄 조회 API
 * GET: 토큰으로 스케줄 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    const { token } = params

    // 토큰으로 배포된 스케줄 찾기
    const deployment = await prisma.scheduleDeployment.findUnique({
      where: {
        publicToken: token
      },
      include: {
        schedule: {
          include: {
            clinic: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    if (!deployment) {
      return unauthorizedResponse('Invalid or expired token')
    }

    // 만료 확인
    if (deployment.expiresAt && deployment.expiresAt < new Date()) {
      return unauthorizedResponse('Token has expired')
    }

    // 해당 월의 시작일과 종료일 계산
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // 해당 월의 마지막 날

    // 해당 스케줄의 근무 배정 조회
    const assignments = await prisma.scheduleAssignment.findMany({
      where: {
        scheduleId: deployment.scheduleId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    // 해당 월의 휴업일 조회
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId: deployment.schedule.clinicId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    // 날짜별로 그룹화
    const daysMap = new Map<string, any>()

    // 월의 모든 날짜 초기화
    for (let day = 1; day <= endDate.getDate(); day++) {
      const date = new Date(year, month - 1, day)
      const dateKey = date.toISOString().split('T')[0]

      daysMap.set(dateKey, {
        date: dateKey,
        dayOfWeek: date.getDay(),
        isHoliday: false,
        holidayName: null,
        assignments: []
      })
    }

    // 휴업일 정보 추가
    holidays.forEach(holiday => {
      const dateKey = holiday.date.toISOString().split('T')[0]
      if (daysMap.has(dateKey)) {
        const day = daysMap.get(dateKey)
        day.isHoliday = true
        day.holidayName = holiday.name
      }
    })

    // 근무 배정 정보 추가
    assignments.forEach(assignment => {
      const dateKey = assignment.date.toISOString().split('T')[0]
      if (daysMap.has(dateKey)) {
        const day = daysMap.get(dateKey)
        day.assignments.push({
          id: assignment.id,
          staff: {
            id: assignment.staff.id,
            name: assignment.staff.name,
            rank: assignment.staff.rank
          },
          shiftType: assignment.shiftType,
          hasNightShift: assignment.hasNightShift,
          leaveType: assignment.leaveType,
          notes: assignment.notes
        })
      }
    })

    // Map을 배열로 변환
    const days = Array.from(daysMap.values())

    return successResponse({
      schedule: {
        id: deployment.schedule.id,
        year: deployment.schedule.year,
        month: deployment.schedule.month,
        status: deployment.schedule.status,
        clinicName: deployment.schedule.clinic.name
      },
      year,
      month,
      days,
      deployment: {
        deployedAt: deployment.deployedAt,
        expiresAt: deployment.expiresAt
      }
    })
  } catch (error) {
    console.error('Get public schedule error:', error)
    return errorResponse('Failed to fetch schedule', 500)
  }
}
