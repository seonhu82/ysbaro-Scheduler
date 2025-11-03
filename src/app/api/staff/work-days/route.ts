/**
 * 직원의 월별 근무일 수 조회 API
 * GET: 특정 직원의 해당 월 근무일 수와 평균 근무일 수 반환
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
    const staffId = searchParams.get('staffId')
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!staffId || !year || !month) {
      return badRequestResponse('staffId, year, month are required')
    }

    const clinicId = session.user.clinicId

    // 해당 월의 시작일과 종료일
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)

    // 해당 직원의 이번 달 근무일 수
    const workDays = await prisma.staffAssignment.count({
      where: {
        staffId,
        date: {
          gte: monthStart,
          lte: monthEnd
        },
        shiftType: {
          in: ['DAY', 'NIGHT']
        }
      }
    })

    // 전체 진료실 직원의 평균 근무일 수 계산
    const allTreatmentStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        departmentName: '진료실'
      },
      select: { id: true }
    })

    let totalWorkDays = 0
    for (const staff of allTreatmentStaff) {
      const count = await prisma.staffAssignment.count({
        where: {
          staffId: staff.id,
          date: {
            gte: monthStart,
            lte: monthEnd
          },
          shiftType: {
            in: ['DAY', 'NIGHT']
          }
        }
      })
      totalWorkDays += count
    }

    const avgWorkDays = allTreatmentStaff.length > 0 ? totalWorkDays / allTreatmentStaff.length : 0

    return successResponse({
      workDays,
      avgWorkDays,
      threshold: avgWorkDays + 3
    })

  } catch (error) {
    console.error('Get work days error:', error)
    return errorResponse('Failed to get work days', 500)
  }
}
