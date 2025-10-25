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
    const deployment = await prisma.scheduleViewLink.findUnique({
      where: {
        token: token
      },
      include: {
        clinic: {
          select: {
            name: true
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

    // 배포 정보에서 year, month 사용 (URL 파라미터는 무시)
    const deployYear = deployment.year
    const deployMonth = deployment.month

    // 해당 월의 시작일과 종료일 계산
    const startDate = new Date(deployYear, deployMonth - 1, 1)
    const endDate = new Date(deployYear, deployMonth, 0) // 해당 월의 마지막 날

    // 해당 월의 DailySlot 조회
    const dailySlots = await prisma.dailySlot.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        week: {
          clinicId: deployment.clinicId,
          year: deployYear,
          month: deployMonth
        }
      },
      include: {
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                rank: true
              }
            }
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
        clinicId: deployment.clinicId,
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
    dailySlots.forEach(slot => {
      const dateKey = slot.date.toISOString().split('T')[0]
      if (daysMap.has(dateKey)) {
        const day = daysMap.get(dateKey)
        day.assignments = slot.staffAssignments.map(assignment => ({
          id: assignment.id,
          staff: {
            id: assignment.staff.id,
            name: assignment.staff.name,
            rank: assignment.staff.rank
          }
        }))
      }
    })

    // Map을 배열로 변환
    const days = Array.from(daysMap.values())

    return successResponse({
      deployment: {
        id: deployment.id,
        year: deployment.year,
        month: deployment.month,
        clinicName: deployment.clinic.name,
        deployedAt: deployment.createdAt,
        expiresAt: deployment.expiresAt
      },
      year: deployYear,
      month: deployMonth,
      days
    })
  } catch (error) {
    console.error('Get public schedule error:', error)
    return errorResponse('Failed to fetch schedule', 500)
  }
}
