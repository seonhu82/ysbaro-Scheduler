/**
 * PDF 내보내기 API
 * POST: 스케줄 데이터를 PDF 파일로 내보내기
 *
 * Note: 실제 PDF 파일 생성을 위해서는 pdf-lib 또는 puppeteer 라이브러리 필요
 * npm install pdf-lib 또는 npm install puppeteer
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
    const { scheduleId, year, month, format = 'calendar' } = body // format: 'calendar' | 'list'

    if (!scheduleId && (!year || !month)) {
      return badRequestResponse('Schedule ID or year/month is required')
    }

    let scheduleData

    if (scheduleId) {
      // 특정 스케줄 내보내기
      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          clinic: {
            select: {
              name: true
            }
          },
          assignments: {
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
          clinic: {
            select: {
              name: true
            }
          },
          assignments: {
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

    // 날짜별로 그룹화
    const assignmentsByDate = new Map<string, any[]>()
    scheduleData.assignments.forEach((assignment: any) => {
      const dateKey = assignment.date.toISOString().split('T')[0]
      if (!assignmentsByDate.has(dateKey)) {
        assignmentsByDate.set(dateKey, [])
      }
      assignmentsByDate.get(dateKey)!.push({
        staffName: assignment.staff.name,
        staffRank: assignment.staff.rank,
        shiftType: assignment.shiftType,
        hasNightShift: assignment.hasNightShift,
        leaveType: assignment.leaveType
      })
    })

    // PDF 데이터 구조 생성
    const pdfData = {
      metadata: {
        clinicName: scheduleData.clinic.name,
        year: scheduleData.year,
        month: scheduleData.month,
        format,
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.name
      },
      calendar: Array.from(assignmentsByDate.entries()).map(([date, assignments]) => ({
        date,
        dayOfWeek: new Date(date).getDay(),
        assignments
      }))
    }

    // 클라이언트에서 PDF 생성을 위한 데이터 반환
    return successResponse(
      pdfData,
      'PDF data prepared successfully'
    )
  } catch (error) {
    console.error('Export PDF error:', error)
    return errorResponse('Failed to export PDF', 500)
  }
}
