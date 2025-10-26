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

    const clinicId = session.user.clinicId
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
        clinicId: clinicId,
        year,
        ...(month && { month })
      },
      include: {
        _count: {
          select: {
            staffAssignments: true
          }
        }
      }
    })

    const scheduleStats = {
      total: schedules.length,
      draft: schedules.filter(s => s.status === 'DRAFT').length,
      confirmed: schedules.filter(s => s.status === 'CONFIRMED').length,
      deployed: schedules.filter(s => s.status === 'DEPLOYED').length,
      totalAssignments: schedules.reduce((sum, s) => sum + s._count.staffAssignments, 0)
    }

    // 2. 연차 신청 통계
    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId: clinicId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    const leaveStats = {
      total: leaveApplications.length,
      pending: leaveApplications.filter(l => l.status === 'PENDING').length,
      approved: leaveApplications.filter(l => l.status === 'CONFIRMED').length,
      rejected: leaveApplications.filter(l => l.status === 'REJECTED').length,
      annual: leaveApplications.filter(l => l.leaveType === 'ANNUAL').length,
      off: leaveApplications.filter(l => l.leaveType === 'OFF').length
    }

    // 3. 직원 통계
    const staff = await prisma.staff.findMany({
      where: {
        clinicId: clinicId,
        isActive: true
      },
      select: {
        id: true,
        rank: true,
        workType: true,
        departmentName: true,
        categoryName: true
      }
    })

    const staffStats = {
      total: staff.length,
      byRank: staff.reduce((acc: any, s) => {
        const rank = s.rank || 'UNKNOWN'
        acc[rank] = (acc[rank] || 0) + 1
        return acc
      }, {}),
      byWorkType: staff.reduce((acc: any, s) => {
        const workType = s.workType || 'UNKNOWN'
        acc[workType] = (acc[workType] || 0) + 1
        return acc
      }, {})
    }

    // 4. 출퇴근 통계
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        clinicId: clinicId,
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
                clinicId: clinicId,
                year,
                month: i + 1
              }
            }),
            prisma.leaveApplication.count({
              where: {
                clinicId: clinicId,
                date: { gte: monthStart, lte: monthEnd }
              }
            }),
            prisma.attendanceRecord.count({
              where: {
                clinicId: clinicId,
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

    // 6. 직원별 통계
    const staffDetails = await Promise.all(
      staff.map(async (s) => {
        const staffFull = await prisma.staff.findUnique({
          where: { id: s.id },
          select: {
            id: true,
            name: true,
            departmentName: true,
            categoryName: true,
            workType: true,
            rank: true
          }
        })

        // 이 기간 동안의 연차/오프
        const staffLeaves = leaveApplications.filter(l => l.staffId === s.id)

        // 형평성 점수
        const fairnessScores = await prisma.fairnessScore.findMany({
          where: {
            staffId: s.id,
            year,
            ...(month && { month })
          }
        })

        // 출퇴근 기록
        const staffAttendance = attendanceRecords.filter(a => a.staffId === s.id)

        return {
          ...staffFull,
          leaves: {
            total: staffLeaves.length,
            annual: staffLeaves.filter(l => l.leaveType === 'ANNUAL').length,
            off: staffLeaves.filter(l => l.leaveType === 'OFF').length
          },
          fairness: fairnessScores.reduce((acc, fs) => ({
            nightShift: acc.nightShift + fs.nightShiftCount,
            weekend: acc.weekend + fs.weekendCount,
            holiday: acc.holiday + fs.holidayCount,
            holidayAdjacent: acc.holidayAdjacent + fs.holidayAdjacentCount
          }), { nightShift: 0, weekend: 0, holiday: 0, holidayAdjacent: 0 }),
          attendance: {
            total: staffAttendance.length,
            checkIn: staffAttendance.filter(a => a.checkType === 'IN').length,
            checkOut: staffAttendance.filter(a => a.checkType === 'OUT').length
          }
        }
      })
    )

    // 7. 부서별 통계
    const departments = Array.from(new Set(staff.map(s => s.departmentName).filter(Boolean)))
    const departmentStats = departments.map(deptName => {
      const deptStaff = staffDetails.filter(s => s.departmentName === deptName)
      return {
        name: deptName,
        staffCount: deptStaff.length,
        leaves: deptStaff.reduce((sum, s) => sum + s.leaves.total, 0),
        attendance: deptStaff.reduce((sum, s) => sum + s.attendance.total, 0),
        fairness: {
          nightShift: deptStaff.reduce((sum, s) => sum + s.fairness.nightShift, 0),
          weekend: deptStaff.reduce((sum, s) => sum + s.fairness.weekend, 0),
          holiday: deptStaff.reduce((sum, s) => sum + s.fairness.holiday, 0)
        }
      }
    })

    // 8. 구분별 통계
    const categories = Array.from(new Set(staff.map(s => s.categoryName).filter(Boolean)))
    const categoryStats = categories.map(catName => {
      const catStaff = staffDetails.filter(s => s.categoryName === catName)
      return {
        name: catName,
        staffCount: catStaff.length,
        leaves: catStaff.reduce((sum, s) => sum + s.leaves.total, 0),
        attendance: catStaff.reduce((sum, s) => sum + s.attendance.total, 0),
        fairness: {
          nightShift: catStaff.reduce((sum, s) => sum + s.fairness.nightShift, 0),
          weekend: catStaff.reduce((sum, s) => sum + s.fairness.weekend, 0),
          holiday: catStaff.reduce((sum, s) => sum + s.fairness.holiday, 0)
        }
      }
    })

    return successResponse({
      period: month ? `${year}-${month.toString().padStart(2, '0')}` : `${year}`,
      schedules: scheduleStats,
      leaves: leaveStats,
      staff: staffStats,
      attendance: attendanceStats,
      staffDetails,
      departments: departmentStats,
      categories: categoryStats,
      ...(monthlyTrend && { monthlyTrend })
    })
  } catch (error) {
    console.error('Get statistics error:', error)
    return errorResponse('Failed to fetch statistics', 500)
  }
}
