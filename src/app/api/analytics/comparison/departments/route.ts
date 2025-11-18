import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/comparison/departments
 *
 * Get department-level KPIs for comparison
 *
 * Query Parameters:
 * - startDate: string (ISO date, optional, defaults to start of current month)
 * - endDate: string (ISO date, optional, defaults to today)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)

    // Date range
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : startOfMonth
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : now

    // Calculate KST date range
    const kstOffset = 9 * 60 * 60 * 1000
    const startDateKST = new Date(startDate.getTime() + kstOffset)
    const endDateKST = new Date(endDate.getTime() + kstOffset)
    const startDateOnly = new Date(Date.UTC(
      startDateKST.getUTCFullYear(),
      startDateKST.getUTCMonth(),
      startDateKST.getUTCDate()
    ))
    const endDateOnly = new Date(Date.UTC(
      endDateKST.getUTCFullYear(),
      endDateKST.getUTCMonth(),
      endDateKST.getUTCDate()
    ))

    // Calculate total work days
    const totalDays = Math.ceil((endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Get all staff grouped by department
    const staff = await prisma.staff.findMany({
      where: {
        clinicId: session.user.clinicId,
      },
      select: {
        id: true,
        name: true,
        departmentName: true,
      },
    })

    // Group staff by department
    const staffByDepartment = staff.reduce((acc, s) => {
      const dept = s.departmentName || '미지정'
      if (!acc[dept]) {
        acc[dept] = []
      }
      acc[dept].push(s)
      return acc
    }, {} as Record<string, typeof staff>)

    // Get all attendance records
    const records = await prisma.attendanceRecord.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: {
          gte: startDateOnly,
          lte: endDateOnly,
        },
      },
      select: {
        staffId: true,
        checkType: true,
        checkTime: true,
        date: true,
      },
    })

    // Get staff assignments for night/weekend counting
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        schedule: {
          clinicId: session.user.clinicId,
        },
        date: {
          gte: startDateOnly,
          lte: endDateOnly,
        },
      },
      select: {
        staffId: true,
        date: true,
        shiftType: true,
      },
    })

    // Calculate KPIs for each department
    const departmentKPIs = Object.entries(staffByDepartment).map(([deptName, deptStaff]) => {
      const staffIds = deptStaff.map(s => s.id)
      const deptRecords = records.filter(r => staffIds.includes(r.staffId))
      const deptAssignments = assignments.filter(a => staffIds.includes(a.staffId))

      // Count night shifts and weekend work
      let nightShiftCount = 0
      let weekendWorkCount = 0

      deptAssignments.forEach(assignment => {
        // Count night shifts
        if (assignment.shiftType === 'NIGHT') {
          nightShiftCount++
        }

        // Count weekend work (Saturday = 6, Sunday = 0)
        const date = new Date(assignment.date)
        const dayOfWeek = date.getUTCDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekendWorkCount++
        }
      })

      // Get unique check-in dates per staff
      const checkInsByStaff = new Map<string, Set<string>>()
      const checkInTimes: number[] = []
      const checkOutTimes: number[] = []

      deptRecords.forEach(record => {
        if (record.checkType === 'IN') {
          if (!checkInsByStaff.has(record.staffId)) {
            checkInsByStaff.set(record.staffId, new Set())
          }
          checkInsByStaff.get(record.staffId)!.add(record.date.toISOString().split('T')[0])

          // Calculate time in minutes
          const kstCheckTime = new Date(new Date(record.checkTime).getTime() + kstOffset)
          const minutes = kstCheckTime.getUTCHours() * 60 + kstCheckTime.getUTCMinutes()
          checkInTimes.push(minutes)
        } else if (record.checkType === 'OUT') {
          const kstCheckTime = new Date(new Date(record.checkTime).getTime() + kstOffset)
          const minutes = kstCheckTime.getUTCHours() * 60 + kstCheckTime.getUTCMinutes()
          checkOutTimes.push(minutes)
        }
      })

      // Calculate attendance rate
      let totalCheckedInDays = 0
      checkInsByStaff.forEach(dates => {
        totalCheckedInDays += dates.size
      })
      const expectedTotalDays = deptStaff.length * totalDays
      const attendanceRate = expectedTotalDays > 0
        ? (totalCheckedInDays / expectedTotalDays) * 100
        : 0

      // Calculate on-time rate (before or at 09:00)
      const onTimeCheckIns = checkInTimes.filter(minutes => minutes <= 9 * 60)
      const onTimeRate = checkInTimes.length > 0
        ? (onTimeCheckIns.length / checkInTimes.length) * 100
        : 0

      // Calculate average check-in time
      const avgCheckInTime = checkInTimes.length > 0
        ? checkInTimes.reduce((sum, val) => sum + val, 0) / checkInTimes.length
        : 0

      // Calculate average check-out time
      const avgCheckOutTime = checkOutTimes.length > 0
        ? checkOutTimes.reduce((sum, val) => sum + val, 0) / checkOutTimes.length
        : 0

      // Calculate average work hours
      const avgWorkMinutes = avgCheckOutTime > 0 && avgCheckInTime > 0
        ? avgCheckOutTime - avgCheckInTime
        : 0
      const avgWorkHours = avgWorkMinutes / 60

      // Count late and early leave
      const lateCount = checkInTimes.filter(minutes => minutes > 9 * 60).length
      const earlyLeaveCount = checkOutTimes.filter(minutes => minutes < 18 * 60).length

      return {
        departmentName: deptName,
        staffCount: deptStaff.length,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        avgCheckInTime: formatTime(Math.round(avgCheckInTime)),
        avgCheckOutTime: formatTime(Math.round(avgCheckOutTime)),
        avgWorkHours: Math.round(avgWorkHours * 10) / 10,
        totalCheckIns: checkInTimes.length,
        totalCheckOuts: checkOutTimes.length,
        lateCount,
        earlyLeaveCount,
        checkedInDays: totalCheckedInDays,
        expectedDays: expectedTotalDays,
        nightShiftCount,
        weekendWorkCount,
      }
    })

    // Sort by attendance rate (descending)
    departmentKPIs.sort((a, b) => b.attendanceRate - a.attendanceRate)

    // Calculate overall averages
    const totalStaff = departmentKPIs.reduce((sum, dept) => sum + dept.staffCount, 0)
    const overallAttendanceRate = totalStaff > 0
      ? departmentKPIs.reduce((sum, dept) => sum + (dept.attendanceRate * dept.staffCount), 0) / totalStaff
      : 0
    const overallOnTimeRate = totalStaff > 0
      ? departmentKPIs.reduce((sum, dept) => sum + (dept.onTimeRate * dept.staffCount), 0) / totalStaff
      : 0

    return successResponse({
      period: {
        startDate: startDateOnly.toISOString(),
        endDate: endDateOnly.toISOString(),
        totalDays,
      },
      departments: departmentKPIs,
      overall: {
        totalStaff,
        avgAttendanceRate: Math.round(overallAttendanceRate * 10) / 10,
        avgOnTimeRate: Math.round(overallOnTimeRate * 10) / 10,
      },
    })

  } catch (error) {
    console.error('Get department comparison error:', error)
    return errorResponse('Failed to fetch department comparison', 500)
  }
}

// Helper function to format minutes to HH:MM
function formatTime(minutes: number): string {
  if (minutes === 0) return '00:00'
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}
