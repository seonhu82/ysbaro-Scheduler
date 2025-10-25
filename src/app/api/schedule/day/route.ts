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

    if (!dateParam) {
      return badRequestResponse('Date parameter is required')
    }

    const targetDate = new Date(dateParam)
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

    // 1. DailySlot 조회
    const dailySlot = await prisma.dailySlot.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        week: {
          clinicId: session.user.clinicId
        }
      },
      include: {
        week: true,
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
      }
    })

    // 2. ScheduleDoctor 조회 (해당 날짜의 원장 스케줄)
    const scheduleDoctors = await prisma.scheduleDoctor.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        schedule: {
          clinicId: session.user.clinicId
        }
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true
          }
        }
      }
    })

    // 데이터가 없으면 빈 스케줄 반환
    if (!dailySlot && scheduleDoctors.length === 0) {
      return successResponse({
        date: dateParam,
        doctors: [],
        staff: [],
        isNightShift: false,
        isEmpty: true
      })
    }

    // 응답 데이터 구성
    const responseData = {
      id: dailySlot?.id,
      date: dateParam,
      doctors: scheduleDoctors.map(sd => ({
        id: sd.doctor.id,
        name: sd.doctor.name,
        specialization: sd.doctor.specialization,
        hasNightShift: sd.hasNightShift
      })),
      staff: dailySlot?.staffAssignments.map(sa => ({
        id: sa.staff.id,
        name: sa.staff.name,
        rank: sa.staff.rank || 'UNKNOWN'
      })) || [],
      isNightShift: scheduleDoctors.some(sd => sd.hasNightShift),
      requiredStaff: dailySlot?.requiredStaff || 0,
      isEmpty: false
    }

    return successResponse(responseData)
  } catch (error) {
    console.error('Get day schedule error:', error)
    return errorResponse('Failed to fetch day schedule', 500)
  }
}
