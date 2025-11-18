import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

/**
 * GET /api/analytics/patterns/heatmap
 *
 * Get heatmap data for attendance patterns (hour x day of week)
 *
 * Query Parameters:
 * - startDate: string (ISO date, optional, defaults to start of current month)
 * - endDate: string (ISO date, optional, defaults to today)
 * - departmentName: string (optional, filter by department)
 * - staffId: string (optional, filter by specific staff)
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
    const staffId = searchParams.get('staffId')

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

    // Build query conditions
    const whereConditions: any = {
      clinicId: session.user.clinicId,
      checkType: 'IN', // Only analyze check-in times
      date: {
        gte: startDateOnly,
        lte: endDateOnly,
      },
    }

    if (staffId) {
      whereConditions.staffId = staffId
    } else if (departmentName) {
      // Get staff IDs in department
      const staffInDept = await prisma.staff.findMany({
        where: {
          clinicId: session.user.clinicId,
          departmentName,
        },
        select: { id: true },
      })
      whereConditions.staffId = { in: staffInDept.map(s => s.id) }
    }

    // Get all check-in records
    const records = await prisma.attendanceRecord.findMany({
      where: whereConditions,
      select: {
        checkTime: true,
        date: true,
      },
    })

    // Initialize heatmap data structure
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const hourlyByDay: Record<string, Record<string, number>> = {}

    days.forEach(day => {
      hourlyByDay[day] = {}
      // Initialize hours 6-22 (6 AM to 10 PM)
      for (let hour = 6; hour <= 22; hour++) {
        hourlyByDay[day][String(hour).padStart(2, '0')] = 0
      }
    })

    // Process records
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    let maxValue = 0
    let totalValue = 0
    let cellCount = 0

    records.forEach(record => {
      // Get day of week
      const date = new Date(record.date)
      const dayOfWeek = dayNames[date.getUTCDay()]

      // Get hour (in KST)
      const checkTime = new Date(record.checkTime)
      const kstCheckTime = new Date(checkTime.getTime() + kstOffset)
      const hour = kstCheckTime.getUTCHours()

      // Increment count
      if (hour >= 6 && hour <= 22) {
        const hourKey = String(hour).padStart(2, '0')
        hourlyByDay[dayOfWeek][hourKey]++

        const value = hourlyByDay[dayOfWeek][hourKey]
        if (value > maxValue) {
          maxValue = value
        }
        totalValue += 1
      }
    })

    // Calculate average (only count non-zero cells)
    days.forEach(day => {
      Object.values(hourlyByDay[day]).forEach(value => {
        if (value > 0) cellCount++
      })
    })
    const avgValue = cellCount > 0 ? totalValue / cellCount : 0

    return successResponse({
      period: {
        startDate: startDateOnly.toISOString(),
        endDate: endDateOnly.toISOString(),
      },
      hourlyByDay,
      metadata: {
        maxValue,
        avgValue: Math.round(avgValue * 10) / 10,
        totalRecords: records.length,
      },
    })

  } catch (error) {
    console.error('Get heatmap data error:', error)
    return errorResponse('Failed to fetch heatmap data', 500)
  }
}
