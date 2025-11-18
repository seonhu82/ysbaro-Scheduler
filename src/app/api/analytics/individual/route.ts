import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/individual
 *
 * Get list of all staff with their attendance summary statistics
 *
 * Query Parameters:
 * - startDate: string (ISO date, optional, defaults to start of current month)
 * - endDate: string (ISO date, optional, defaults to today)
 * - departmentName: string (optional, filter by department)
 * - search: string (optional, search by staff name)
 * - sortBy: 'name' | 'attendanceRate' | 'lateCount' | 'onTimeRate' (optional, defaults to 'name')
 * - sortOrder: 'asc' | 'desc' (optional, defaults to 'asc')
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

    // Filters
    const departmentName = searchParams.get('departmentName')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Get all staff in clinic
    const staffList = await prisma.staff.findMany({
      where: {
        clinicId: session.user.clinicId,
        ...(departmentName && { departmentName }),
        ...(search && {
          name: { contains: search, mode: 'insensitive' }
        }),
      },
      select: {
        id: true,
        name: true,
        departmentName: true,
        categoryName: true,
        rank: true,
        workType: true,
      },
    })

    // Calculate KST date range for queries
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

    // Calculate total work days in range (excluding weekends for now)
    const totalDays = Math.ceil((endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24))
    const workDays = totalDays // Simplified, could exclude weekends/holidays

    // Get attendance records for all staff in date range
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        clinicId: session.user.clinicId,
        staffId: { in: staffList.map(s => s.id) },
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
        checkMethod: true,
      },
      orderBy: {
        checkTime: 'asc',
      },
    })

    // Group records by staff
    const recordsByStaff = attendanceRecords.reduce((acc, record) => {
      if (!acc[record.staffId]) {
        acc[record.staffId] = []
      }
      acc[record.staffId].push(record)
      return acc
    }, {} as Record<string, typeof attendanceRecords>)

    // Calculate statistics for each staff
    const staffWithStats = staffList.map(staff => {
      const records = recordsByStaff[staff.id] || []

      // Get unique check-in dates
      const checkInDates = new Set(
        records
          .filter(r => r.checkType === 'IN')
          .map(r => r.date.toISOString().split('T')[0])
      )
      const checkedInDays = checkInDates.size

      // Calculate average check-in and check-out times
      const checkInRecords = records.filter(r => r.checkType === 'IN')
      const checkOutRecords = records.filter(r => r.checkType === 'OUT')

      const avgCheckInTime = checkInRecords.length > 0
        ? calculateAverageTime(checkInRecords.map(r => r.checkTime))
        : null

      const avgCheckOutTime = checkOutRecords.length > 0
        ? calculateAverageTime(checkOutRecords.map(r => r.checkTime))
        : null

      // Calculate late count (after 09:00)
      const lateCount = checkInRecords.filter(r => {
        const checkTime = new Date(r.checkTime)
        const kstCheckTime = new Date(checkTime.getTime() + kstOffset)
        const hour = kstCheckTime.getUTCHours()
        const minute = kstCheckTime.getUTCMinutes()
        return hour > 9 || (hour === 9 && minute > 0)
      }).length

      // Calculate early leave count (before 18:00)
      const earlyLeaveCount = checkOutRecords.filter(r => {
        const checkTime = new Date(r.checkTime)
        const kstCheckTime = new Date(checkTime.getTime() + kstOffset)
        const hour = kstCheckTime.getUTCHours()
        const minute = kstCheckTime.getUTCMinutes()
        return hour < 18 || (hour === 18 && minute < 0)
      }).length

      // Calculate rates
      const attendanceRate = workDays > 0 ? (checkedInDays / workDays) * 100 : 0
      const onTimeRate = checkInRecords.length > 0
        ? ((checkInRecords.length - lateCount) / checkInRecords.length) * 100
        : 0

      return {
        ...staff,
        stats: {
          totalDays: workDays,
          checkedInDays,
          attendanceRate: Math.round(attendanceRate * 10) / 10,
          avgCheckInTime,
          avgCheckOutTime,
          lateCount,
          earlyLeaveCount,
          onTimeRate: Math.round(onTimeRate * 10) / 10,
          totalCheckIns: checkInRecords.length,
          totalCheckOuts: checkOutRecords.length,
        },
      }
    })

    // Sort results
    const sortedStaff = staffWithStats.sort((a, b) => {
      let aVal, bVal

      switch (sortBy) {
        case 'attendanceRate':
          aVal = a.stats.attendanceRate
          bVal = b.stats.attendanceRate
          break
        case 'lateCount':
          aVal = a.stats.lateCount
          bVal = b.stats.lateCount
          break
        case 'onTimeRate':
          aVal = a.stats.onTimeRate
          bVal = b.stats.onTimeRate
          break
        default: // 'name'
          aVal = a.name
          bVal = b.name
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal, 'ko')
          : bVal.localeCompare(aVal, 'ko')
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }

      return 0
    })

    // Calculate summary statistics
    const summary = {
      totalStaff: staffList.length,
      avgAttendanceRate: staffWithStats.length > 0
        ? Math.round((staffWithStats.reduce((sum, s) => sum + s.stats.attendanceRate, 0) / staffWithStats.length) * 10) / 10
        : 0,
      avgOnTimeRate: staffWithStats.length > 0
        ? Math.round((staffWithStats.reduce((sum, s) => sum + s.stats.onTimeRate, 0) / staffWithStats.length) * 10) / 10
        : 0,
      totalLates: staffWithStats.reduce((sum, s) => sum + s.stats.lateCount, 0),
      totalEarlyLeaves: staffWithStats.reduce((sum, s) => sum + s.stats.earlyLeaveCount, 0),
    }

    return successResponse({
      period: {
        startDate: startDateOnly.toISOString(),
        endDate: endDateOnly.toISOString(),
        totalDays: workDays,
      },
      summary,
      staff: sortedStaff,
    })

  } catch (error) {
    console.error('Get individual analytics error:', error)
    return errorResponse('Failed to fetch individual analytics', 500)
  }
}

// Helper function to calculate average time from Date objects
function calculateAverageTime(dates: Date[]): string {
  if (dates.length === 0) return '00:00'

  const kstOffset = 9 * 60 * 60 * 1000
  const totalMinutes = dates.reduce((sum, date) => {
    const kstDate = new Date(date.getTime() + kstOffset)
    const hours = kstDate.getUTCHours()
    const minutes = kstDate.getUTCMinutes()
    return sum + (hours * 60 + minutes)
  }, 0)

  const avgMinutes = Math.round(totalMinutes / dates.length)
  const hours = Math.floor(avgMinutes / 60)
  const minutes = avgMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
