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

    // 6. 배치 기반 근무 통계 (StaffAssignment) - 먼저 조회
    const allAssignments = await prisma.staffAssignment.findMany({
      where: {
        staffId: {
          in: staff.map(s => s.id)
        },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        staffId: true,
        shiftType: true,
        date: true
      }
    })

    const dayShiftCount = allAssignments.filter(a => a.shiftType === 'DAY').length
    const nightShiftCount = allAssignments.filter(a => a.shiftType === 'NIGHT').length
    const offCount = allAssignments.filter(a => a.shiftType === 'OFF').length
    const weekendCount = allAssignments.filter(a => {
      const day = new Date(a.date).getDay()
      return day === 0 || day === 6
    }).length

    // 야간 근무가 있는 날짜들 추출
    const nightShiftDates = new Set(
      allAssignments
        .filter(a => a.shiftType === 'NIGHT')
        .map(a => a.date.toISOString().split('T')[0])
    )

    // 연차는 LeaveApplication에서 조회 (status 무관하게 전체)
    const annualLeaves = leaveApplications.filter(l => l.leaveType === 'ANNUAL')
    const offLeaves = leaveApplications.filter(l => l.leaveType === 'OFF')

    const workStats = {
      total: dayShiftCount + nightShiftCount + offCount + annualLeaves.length,
      dayShift: dayShiftCount,
      nightShift: nightShiftCount,
      off: offCount,
      annual: annualLeaves.length,
      weekend: weekendCount
    }

    // 7. 직원별 통계
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

    // 8. 부서별 통계
    const departments = Array.from(new Set(staff.map(s => s.departmentName).filter(Boolean)))
    const departmentStats = departments.map(deptName => {
      const deptStaffIds = staff.filter(s => s.departmentName === deptName).map(s => s.id)
      const deptAssignments = allAssignments.filter(a => deptStaffIds.includes(a.staffId))
      const deptLeaves = leaveApplications.filter(l => deptStaffIds.includes(l.staffId))

      // 야간 근무: NIGHT shiftType이거나, 야간 근무가 있는 날에 배치된 경우
      const deptNightShift = deptAssignments.filter(a => {
        if (a.shiftType === 'NIGHT') return true
        const dateStr = a.date.toISOString().split('T')[0]
        return nightShiftDates.has(dateStr) && a.shiftType !== 'OFF'
      }).length

      return {
        name: deptName,
        staffCount: deptStaffIds.length,
        annual: deptLeaves.filter(l => l.leaveType === 'ANNUAL').length,
        off: deptAssignments.filter(a => a.shiftType === 'OFF').length,
        nightShift: deptNightShift,
        weekend: deptAssignments.filter(a => {
          const day = new Date(a.date).getDay()
          return day === 0 || day === 6
        }).length
      }
    })

    // 9. 구분별 통계
    const categories = Array.from(new Set(staff.map(s => s.categoryName).filter(Boolean)))
    const categoryStats = categories.map(catName => {
      const catStaffIds = staff.filter(s => s.categoryName === catName).map(s => s.id)
      const catAssignments = allAssignments.filter(a => catStaffIds.includes(a.staffId))
      const catLeaves = leaveApplications.filter(l => catStaffIds.includes(l.staffId))

      // 야간 근무: NIGHT shiftType이거나, 야간 근무가 있는 날에 배치된 경우
      const catNightShift = catAssignments.filter(a => {
        if (a.shiftType === 'NIGHT') return true
        const dateStr = a.date.toISOString().split('T')[0]
        return nightShiftDates.has(dateStr) && a.shiftType !== 'OFF'
      }).length

      return {
        name: catName,
        staffCount: catStaffIds.length,
        annual: catLeaves.filter(l => l.leaveType === 'ANNUAL').length,
        off: catAssignments.filter(a => a.shiftType === 'OFF').length,
        nightShift: catNightShift,
        weekend: catAssignments.filter(a => {
          const day = new Date(a.date).getDay()
          return day === 0 || day === 6
        }).length
      }
    })

    // 10. 형평성 설정 확인
    const fairnessSettings = await prisma.fairnessSettings.findUnique({
      where: { clinicId: clinicId }
    })

    return successResponse({
      period: month ? `${year}-${month.toString().padStart(2, '0')}` : `${year}`,
      schedules: scheduleStats,
      leaves: leaveStats,
      staff: staffStats,
      attendance: attendanceStats,
      work: workStats,
      useHolidayFairness: fairnessSettings?.useHolidayFairness ?? false,
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
