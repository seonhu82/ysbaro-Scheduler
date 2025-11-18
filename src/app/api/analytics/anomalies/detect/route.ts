import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'
import { AnomalyDetector, AnomalyRecord } from '@/lib/services/anomaly-detector'

/**
 * GET /api/analytics/anomalies/detect
 *
 * Run anomaly detection algorithms on attendance records
 *
 * Query Parameters:
 * - startDate: string (ISO date, optional, defaults to start of current month)
 * - endDate: string (ISO date, optional, defaults to today)
 * - staffId: string (optional, detect for specific staff)
 * - departmentName: string (optional, detect for specific department)
 * - threshold: number (optional, Z-score threshold, defaults to 2.5)
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
    const staffId = searchParams.get('staffId')
    const departmentName = searchParams.get('departmentName')
    const threshold = searchParams.get('threshold')
      ? parseFloat(searchParams.get('threshold')!)
      : 2.5

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
      date: {
        gte: startDateOnly,
        lte: endDateOnly,
      },
    }

    if (staffId) {
      whereConditions.staffId = staffId
    } else if (departmentName) {
      const staffInDept = await prisma.staff.findMany({
        where: {
          clinicId: session.user.clinicId,
          departmentName,
        },
        select: { id: true },
      })
      whereConditions.staffId = { in: staffInDept.map(s => s.id) }
    }

    // Get attendance records with staff info
    const records = await prisma.attendanceRecord.findMany({
      where: whereConditions,
      select: {
        id: true,
        staffId: true,
        checkType: true,
        checkTime: true,
        date: true,
        ipAddress: true,
        staff: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        checkTime: 'asc',
      },
    })

    // Initialize detector
    const detector = new AnomalyDetector()
    let allAnomalies: AnomalyRecord[] = []

    // Prepare data for time-based detection (check-in times)
    const checkInData = records
      .filter(r => r.checkType === 'IN')
      .map(r => {
        const kstCheckTime = new Date(new Date(r.checkTime).getTime() + kstOffset)
        const minutes = kstCheckTime.getUTCHours() * 60 + kstCheckTime.getUTCMinutes()
        return {
          date: r.date.toISOString().split('T')[0],
          value: minutes,
          staffId: r.staffId,
          staffName: r.staff.name,
          checkTime: r.checkTime,
          ipAddress: r.ipAddress || 'unknown',
        }
      })

    // Prepare data for check-out times
    const checkOutData = records
      .filter(r => r.checkType === 'OUT')
      .map(r => {
        const kstCheckTime = new Date(new Date(r.checkTime).getTime() + kstOffset)
        const minutes = kstCheckTime.getUTCHours() * 60 + kstCheckTime.getUTCMinutes()
        return {
          date: r.date.toISOString().split('T')[0],
          value: minutes,
          staffId: r.staffId,
          staffName: r.staff.name,
          checkTime: r.checkTime,
          ipAddress: r.ipAddress || 'unknown',
        }
      })

    // Run Z-Score detection on check-ins
    if (checkInData.length >= 5) {
      const zScoreAnomalies = detector.detectZScoreOutliers(checkInData, 'IN')
      allAnomalies.push(...zScoreAnomalies)
    }

    // Run Z-Score detection on check-outs
    if (checkOutData.length >= 5) {
      const zScoreAnomalies = detector.detectZScoreOutliers(checkOutData, 'OUT')
      allAnomalies.push(...zScoreAnomalies)
    }

    // Run IQR detection on check-ins
    if (checkInData.length >= 4) {
      const iqrAnomalies = detector.detectIQROutliers(checkInData, 'IN')
      allAnomalies.push(...iqrAnomalies)
    }

    // Run IQR detection on check-outs
    if (checkOutData.length >= 4) {
      const iqrAnomalies = detector.detectIQROutliers(checkOutData, 'OUT')
      allAnomalies.push(...iqrAnomalies)
    }

    // Detect consecutive patterns (group by staff)
    const staffRecordsMap = new Map<string, Array<{
      date: string
      isLate?: boolean
      isEarly?: boolean
      staffId: string
      staffName: string
    }>>()

    // Build staff-specific records with late/early flags
    const recordsByDate = new Map<string, { checkIns: typeof records, checkOuts: typeof records }>()
    records.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0]
      if (!recordsByDate.has(dateKey)) {
        recordsByDate.set(dateKey, { checkIns: [], checkOuts: [] })
      }
      if (record.checkType === 'IN') {
        recordsByDate.get(dateKey)!.checkIns.push(record)
      } else {
        recordsByDate.get(dateKey)!.checkOuts.push(record)
      }
    })

    // Calculate late/early for each day
    recordsByDate.forEach((dayRecords, date) => {
      dayRecords.checkIns.forEach(checkIn => {
        const kstCheckIn = new Date(new Date(checkIn.checkTime).getTime() + kstOffset)
        const hour = kstCheckIn.getUTCHours()
        const minute = kstCheckIn.getUTCMinutes()
        const isLate = hour > 9 || (hour === 9 && minute > 0)

        if (!staffRecordsMap.has(checkIn.staffId)) {
          staffRecordsMap.set(checkIn.staffId, [])
        }
        staffRecordsMap.get(checkIn.staffId)!.push({
          date,
          isLate,
          staffId: checkIn.staffId,
          staffName: checkIn.staff.name,
        })
      })

      dayRecords.checkOuts.forEach(checkOut => {
        const kstCheckOut = new Date(new Date(checkOut.checkTime).getTime() + kstOffset)
        const hour = kstCheckOut.getUTCHours()
        const minute = kstCheckOut.getUTCMinutes()
        const isEarly = hour < 18 || (hour === 18 && minute < 0)

        const existing = staffRecordsMap.get(checkOut.staffId)?.find(r => r.date === date)
        if (existing) {
          existing.isEarly = isEarly
        }
      })
    })

    // Run consecutive pattern detection for each staff
    staffRecordsMap.forEach((staffRecords) => {
      const consecutiveAnomalies = detector.detectConsecutivePatterns(staffRecords, 3)
      allAnomalies.push(...consecutiveAnomalies)
    })

    // Detect missing check-outs
    staffRecordsMap.forEach((staffRecords, staffId) => {
      const checkoutRecords = []
      for (const record of staffRecords) {
        const dateRecords = recordsByDate.get(record.date)
        const hasCheckIn = dateRecords?.checkIns.some(r => r.staffId === staffId) || false
        const hasCheckOut = dateRecords?.checkOuts.some(r => r.staffId === staffId) || false
        checkoutRecords.push({
          date: record.date,
          hasCheckIn,
          hasCheckOut,
          staffId: record.staffId,
          staffName: record.staffName,
        })
      }

      const missingCheckoutAnomalies = detector.detectMissingCheckouts(checkoutRecords, 0.3)
      allAnomalies.push(...missingCheckoutAnomalies)
    })

    // Detect IP anomalies (group by staff)
    const staffIPRecords = new Map<string, typeof checkInData>()
    checkInData.forEach(record => {
      if (!staffIPRecords.has(record.staffId)) {
        staffIPRecords.set(record.staffId, [])
      }
      staffIPRecords.get(record.staffId)!.push(record)
    })

    staffIPRecords.forEach(staffRecords => {
      const ipAnomalies = detector.detectIPAnomalies(staffRecords)
      allAnomalies.push(...ipAnomalies)
    })

    // Deduplicate anomalies
    const uniqueAnomalies = detector.deduplicateAnomalies(allAnomalies)

    // Sort by severity and date
    const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    uniqueAnomalies.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) return severityDiff
      return b.date.localeCompare(a.date)
    })

    // Calculate summary
    const summary = {
      total: uniqueAnomalies.length,
      byType: uniqueAnomalies.reduce((acc, anomaly) => {
        acc[anomaly.type] = (acc[anomaly.type] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      bySeverity: {
        HIGH: uniqueAnomalies.filter(a => a.severity === 'HIGH').length,
        MEDIUM: uniqueAnomalies.filter(a => a.severity === 'MEDIUM').length,
        LOW: uniqueAnomalies.filter(a => a.severity === 'LOW').length,
      },
    }

    return successResponse({
      period: {
        startDate: startDateOnly.toISOString(),
        endDate: endDateOnly.toISOString(),
      },
      anomalies: uniqueAnomalies,
      summary,
    })

  } catch (error) {
    console.error('Anomaly detection error:', error)
    return errorResponse('Failed to detect anomalies', 500)
  }
}
