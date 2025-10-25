/**
 * Excel 내보내기 API
 * POST: 스케줄 데이터를 Excel 파일로 내보내기
 *
 * Note: 실제 Excel 파일 생성을 위해서는 xlsx 라이브러리 필요
 * npm install xlsx
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { scheduleId, year, month } = body

    if (!scheduleId && (!year || !month)) {
      return badRequestResponse('Schedule ID or year/month is required')
    }

    let scheduleData

    if (scheduleId) {
      // 특정 스케줄 내보내기
      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          staffAssignments: {
            include: {
              staff: {
                select: {
                  name: true,
                  rank: true
                }
              }
            },
            orderBy: {
              date: 'asc'
            }
          }
        }
      })

      if (!schedule) {
        return badRequestResponse('Schedule not found')
      }

      if (schedule.clinicId !== session.user.clinicId) {
        return unauthorizedResponse()
      }

      scheduleData = schedule
    } else {
      // 연월 기준 데이터 내보내기
      const schedules = await prisma.schedule.findMany({
        where: {
          clinicId: session.user.clinicId,
          year,
          month
        },
        include: {
          staffAssignments: {
            include: {
              staff: {
                select: {
                  name: true,
                  rank: true
                }
              }
            },
            orderBy: {
              date: 'asc'
            }
          }
        }
      })

      if (schedules.length === 0) {
        return badRequestResponse('No schedules found for the specified period')
      }

      scheduleData = schedules[0]
    }

    // Excel 데이터 구조 생성
    // 실제 파일 생성은 클라이언트 측 또는 xlsx 라이브러리 사용
    const excelData = {
      metadata: {
        year: scheduleData.year,
        month: scheduleData.month,
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.name
      },
      assignments: scheduleData.staffAssignments.map((assignment: any) => ({
        date: assignment.date.toISOString().split('T')[0],
        staffName: assignment.staff.name,
        staffRank: assignment.staff.rank,
        shiftType: assignment.shiftType
      }))
    }

    // 클라이언트에서 Excel 생성을 위한 데이터 반환
    return successResponse(
      excelData,
      'Excel data prepared successfully'
    )
  } catch (error) {
    console.error('Export Excel error:', error)
    return errorResponse('Failed to export Excel', 500)
  }
}
