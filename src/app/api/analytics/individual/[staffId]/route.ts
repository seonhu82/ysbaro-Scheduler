import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/individual/[staffId]
 *
 * Get detailed attendance analytics for a specific staff member
 *
 * Query Parameters:
 * - startDate: string (ISO date, optional, defaults to start of current month)
 * - endDate: string (ISO date, optional, defaults to today)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { staffId: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { staffId } = params
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

    // Get staff info
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        departmentName: true,
        categoryName: true,
        rank: true,
        workType: true,
        clinicId: true,
      },
    })

    if (!staff || staff.clinicId !== session.user.clinicId) {
      return errorResponse('Staff not found', 404)
    }

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

    // Calculate total work days in range
    const totalDays = Math.ceil((endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Get all attendance records for this staff in date range
    const records = await prisma.attendanceRecord.findMany({
      where: {
        staffId,
        date: {
          gte: startDateOnly,
          lte: endDateOnly,
        },
      },
      select: {
        id: true,
        checkType: true,
        checkTime: true,
        date: true,
        checkMethod: true,
        isSuspicious: true,
        suspiciousReason: true,
      },
      orderBy: {
        checkTime: 'asc',
      },
    })

    // Group records by date
    const recordsByDate = records.reduce((acc, record) => {
      const dateKey = record.date.toISOString().split('T')[0]
      if (!acc[dateKey]) {
        acc[dateKey] = { checkIns: [], checkOuts: [] }
      }
      if (record.checkType === 'IN') {
        acc[dateKey].checkIns.push(record)
      } else {
        acc[dateKey].checkOuts.push(record)
      }
      return acc
    }, {} as Record<string, { checkIns: typeof records, checkOuts: typeof records }>)

    // Build time series data
    const timeSeries = []
    let currentDate = new Date(startDateOnly)
    while (currentDate <= endDateOnly) {
      const dateKey = currentDate.toISOString().split('T')[0]
      const dayRecords = recordsByDate[dateKey]

      if (dayRecords) {
        // Get first check-in and last check-out
        const firstCheckIn = dayRecords.checkIns[0]
        const lastCheckOut = dayRecords.checkOuts[dayRecords.checkOuts.length - 1]

        const checkInTime = firstCheckIn ? new Date(firstCheckIn.checkTime) : null
        const checkOutTime = lastCheckOut ? new Date(lastCheckOut.checkTime) : null

        // Calculate if late/early leave (KST)
        let isLate = false
        let lateMinutes = 0
        let isEarlyLeave = false
        let earlyMinutes = 0

        if (checkInTime) {
          const kstCheckIn = new Date(checkInTime.getTime() + kstOffset)
          const hour = kstCheckIn.getUTCHours()
          const minute = kstCheckIn.getUTCMinutes()
          if (hour > 9 || (hour === 9 && minute > 0)) {
            isLate = true
            lateMinutes = (hour - 9) * 60 + minute
          }
        }

        if (checkOutTime) {
          const kstCheckOut = new Date(checkOutTime.getTime() + kstOffset)
          const hour = kstCheckOut.getUTCHours()
          const minute = kstCheckOut.getUTCMinutes()
          if (hour < 18 || (hour === 18 && minute < 0)) {
            isEarlyLeave = true
            earlyMinutes = (18 - hour) * 60 + (0 - minute)
          }
        }

        timeSeries.push({
          date: dateKey,
          checkIn: checkInTime ? formatKSTTime(checkInTime, kstOffset) : null,
          checkOut: checkOutTime ? formatKSTTime(checkOutTime, kstOffset) : null,
          isLate,
          lateMinutes,
          isEarlyLeave,
          earlyMinutes,
          checkInMethod: firstCheckIn?.checkMethod || null,
          checkOutMethod: lastCheckOut?.checkMethod || null,
          isSuspicious: firstCheckIn?.isSuspicious || lastCheckOut?.isSuspicious || false,
          suspiciousReason: firstCheckIn?.suspiciousReason || lastCheckOut?.suspiciousReason || null,
        })
      } else {
        timeSeries.push({
          date: dateKey,
          checkIn: null,
          checkOut: null,
          isLate: false,
          lateMinutes: 0,
          isEarlyLeave: false,
          earlyMinutes: 0,
          checkInMethod: null,
          checkOutMethod: null,
          isSuspicious: false,
          suspiciousReason: null,
        })
      }

      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }

    // Calculate summary statistics
    const checkInRecords = records.filter(r => r.checkType === 'IN')
    const checkOutRecords = records.filter(r => r.checkType === 'OUT')

    const checkedInDays = Object.keys(recordsByDate).filter(
      date => recordsByDate[date].checkIns.length > 0
    ).length

    const avgCheckInTime = checkInRecords.length > 0
      ? calculateAverageTime(checkInRecords.map(r => r.checkTime), kstOffset)
      : null

    const avgCheckOutTime = checkOutRecords.length > 0
      ? calculateAverageTime(checkOutRecords.map(r => r.checkTime), kstOffset)
      : null

    const lateCount = timeSeries.filter(t => t.isLate).length
    const earlyLeaveCount = timeSeries.filter(t => t.isEarlyLeave).length

    const attendanceRate = totalDays > 0 ? (checkedInDays / totalDays) * 100 : 0
    const onTimeRate = checkInRecords.length > 0
      ? ((checkInRecords.length - lateCount) / checkInRecords.length) * 100
      : 0

    // Pattern analysis: Day of week distribution
    const dayOfWeekPattern = {
      monday: { count: 0, lateCount: 0, avgCheckIn: [] as Date[] },
      tuesday: { count: 0, lateCount: 0, avgCheckIn: [] as Date[] },
      wednesday: { count: 0, lateCount: 0, avgCheckIn: [] as Date[] },
      thursday: { count: 0, lateCount: 0, avgCheckIn: [] as Date[] },
      friday: { count: 0, lateCount: 0, avgCheckIn: [] as Date[] },
      saturday: { count: 0, lateCount: 0, avgCheckIn: [] as Date[] },
      sunday: { count: 0, lateCount: 0, avgCheckIn: [] as Date[] },
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

    timeSeries.forEach(day => {
      if (day.checkIn) {
        const date = new Date(day.date)
        const dayOfWeek = dayNames[date.getUTCDay()]
        dayOfWeekPattern[dayOfWeek].count++
        if (day.isLate) {
          dayOfWeekPattern[dayOfWeek].lateCount++
        }
        // Store check-in time for average calculation
        const [hours, minutes] = day.checkIn.split(':').map(Number)
        const checkInDate = new Date()
        checkInDate.setHours(hours, minutes, 0, 0)
        dayOfWeekPattern[dayOfWeek].avgCheckIn.push(checkInDate)
      }
    })

    // Calculate averages and rates for each day
    const dayOfWeekStats = Object.entries(dayOfWeekPattern).map(([day, data]) => ({
      day,
      count: data.count,
      lateRate: data.count > 0 ? (data.lateCount / data.count) * 100 : 0,
      avgCheckIn: data.avgCheckIn.length > 0
        ? calculateAverageTime(data.avgCheckIn, 0)
        : null,
    }))

    // Check-in time distribution (hourly)
    const checkInDistribution: Record<string, number> = {}
    checkInRecords.forEach(record => {
      const kstCheckIn = new Date(new Date(record.checkTime).getTime() + kstOffset)
      const hour = kstCheckIn.getUTCHours()
      const timeRange = `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`
      checkInDistribution[timeRange] = (checkInDistribution[timeRange] || 0) + 1
    })

    return successResponse({
      staff: {
        id: staff.id,
        name: staff.name,
        departmentName: staff.departmentName,
        categoryName: staff.categoryName,
        rank: staff.rank,
        workType: staff.workType,
      },
      period: {
        startDate: startDateOnly.toISOString(),
        endDate: endDateOnly.toISOString(),
        totalDays,
      },
      summary: {
        totalDays,
        checkedInDays,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        avgCheckInTime,
        avgCheckOutTime,
        lateCount,
        earlyLeaveCount,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        totalCheckIns: checkInRecords.length,
        totalCheckOuts: checkOutRecords.length,
        suspiciousCount: records.filter(r => r.isSuspicious).length,
      },
      timeSeries,
      patterns: {
        checkInDistribution,
        dayOfWeekTrend: dayOfWeekStats,
      },
    })

  } catch (error) {
    console.error('Get individual staff analytics error:', error)
    return errorResponse('Failed to fetch staff analytics', 500)
  }
}

// Helper function to format time in KST
function formatKSTTime(date: Date, kstOffset: number): string {
  const kstDate = new Date(date.getTime() + kstOffset)
  const hours = kstDate.getUTCHours()
  const minutes = kstDate.getUTCMinutes()
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// Helper function to calculate average time from Date objects
function calculateAverageTime(dates: Date[], kstOffset: number): string {
  if (dates.length === 0) return '00:00'

  const totalMinutes = dates.reduce((sum, date) => {
    const adjustedDate = kstOffset !== 0 ? new Date(date.getTime() + kstOffset) : date
    const hours = kstOffset !== 0 ? adjustedDate.getUTCHours() : adjustedDate.getHours()
    const minutes = kstOffset !== 0 ? adjustedDate.getUTCMinutes() : adjustedDate.getMinutes()
    return sum + (hours * 60 + minutes)
  }, 0)

  const avgMinutes = Math.round(totalMinutes / dates.length)
  const hours = Math.floor(avgMinutes / 60)
  const minutes = avgMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
