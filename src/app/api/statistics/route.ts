/**
 * 통계 조회 API
 * GET: 종합 통계 데이터
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null

    // 기간 설정
    let startDate: Date
    let endDate: Date

    if (month) {
      // 월별 통계
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0, 23, 59, 59)
    } else {
      // 연간 통계
      startDate = new Date(year, 0, 1)
      endDate = new Date(year, 11, 31, 23, 59, 59)
    }

    // 1. 스케줄 통계
    const schedules = await prisma.schedule.findMany({
      where: {
        clinicId: session.user.clinicId,
        year,
        ...(month && { month })
      },
      include: {
        _count: {
          select: {
            assignments: true
          }
        }
      }
    })

    const scheduleStats = {
      total: schedules.length,
      draft: schedules.filter(s => s.status === 'DRAFT').length,
      confirmed: schedules.filter(s => s.status === 'CONFIRMED').length,
      deployed: schedules.filter(s => s.status === 'DEPLOYED').length,
      totalAssignments: schedules.reduce((sum, s) => sum + s._count.assignments, 0)
    }

    // 2. 연차 신청 통계
    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    const leaveStats = {
      total: leaveApplications.length,
      pending: leaveApplications.filter(l => l.status === 'PENDING').length,
      approved: leaveApplications.filter(l => l.status === 'APPROVED').length,
      rejected: leaveApplications.filter(l => l.status === 'REJECTED').length,
      annual: leaveApplications.filter(l => l.leaveType === 'ANNUAL').length,
      off: leaveApplications.filter(l => l.leaveType === 'OFF').length
    }

    // 3. 직원 통계
    const staff = await prisma.staff.findMany({
      where: {
        clinicId: session.user.clinicId,
        isActive: true
      },
      select: {
        rank: true,
        workType: true
      }
    })

    const staffStats = {
      total: staff.length,
      byRank: staff.reduce((acc: any, s) => {
        acc[s.rank] = (acc[s.rank] || 0) + 1
        return acc
      }, {}),
      byWorkType: staff.reduce((acc: any, s) => {
        acc[s.workType] = (acc[s.workType] || 0) + 1
        return acc
      }, {})
    }

    // 4. 출퇴근 통계
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    const attendanceStats = {
      total: attendanceRecords.length,
      checkIn: attendanceRecords.filter(a => a.checkType === 'IN').length,
      checkOut: attendanceRecords.filter(a => a.checkType === 'OUT').length,
      suspicious: attendanceRecords.filter(a => a.isSuspicious).length
    }

    // 5. 월별 추이 (연간 조회시)
    let monthlyTrend = null
    if (!month) {
      monthlyTrend = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const monthStart = new Date(year, i, 1)
          const monthEnd = new Date(year, i + 1, 0)

          const [scheduleCount, leaveCount, attendanceCount] = await Promise.all([
            prisma.schedule.count({
              where: {
                clinicId: session.user.clinicId,
                year,
                month: i + 1
              }
            }),
            prisma.leaveApplication.count({
              where: {
                clinicId: session.user.clinicId,
                date: { gte: monthStart, lte: monthEnd }
              }
            }),
            prisma.attendanceRecord.count({
              where: {
                clinicId: session.user.clinicId,
                date: { gte: monthStart, lte: monthEnd }
              }
            })
          ])

          return {
            month: i + 1,
            schedules: scheduleCount,
            leaves: leaveCount,
            attendance: attendanceCount
          }
        })
      )
    }

    return successResponse({
      period: month ? `${year}-${month.toString().padStart(2, '0')}` : `${year}`,
      schedules: scheduleStats,
      leaves: leaveStats,
      staff: staffStats,
      attendance: attendanceStats,
      ...(monthlyTrend && { monthlyTrend })
    })
  } catch (error) {
    console.error('Get statistics error:', error)
    return errorResponse('Failed to fetch statistics', 500)
  }
}
