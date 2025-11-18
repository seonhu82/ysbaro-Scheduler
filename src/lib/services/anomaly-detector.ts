/**
 * Anomaly Detection Service
 *
 * Implements statistical algorithms to detect unusual attendance patterns:
 * - Z-Score: For numeric outliers (check-in/out times)
 * - IQR Method: For robust outlier detection
 * - Pattern Matching: Rule-based detection (consecutive issues, etc.)
 */

export interface AnomalyRecord {
  id: string
  type: AnomalyType
  staffId: string
  staffName: string
  date: string
  checkTime: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  score: number
  description: string
  expectedRange?: string
  actualValue?: string
  context?: any
}

export type AnomalyType =
  | 'OUTLIER_CHECK_IN_EARLY'    // Extremely early check-in
  | 'OUTLIER_CHECK_IN_LATE'     // Extremely late check-in
  | 'OUTLIER_CHECK_OUT_EARLY'   // Extremely early check-out
  | 'OUTLIER_CHECK_OUT_LATE'    // Extremely late check-out
  | 'PATTERN_CONSECUTIVE_LATE'  // Multiple consecutive late arrivals
  | 'PATTERN_CONSECUTIVE_EARLY' // Multiple consecutive early leaves
  | 'PATTERN_MISSING_CHECKOUT'  // Frequent missing check-outs
  | 'PATTERN_IP_ANOMALY'        // Unusual IP address pattern
  | 'PATTERN_WEEKEND_SPIKE'     // Unexpected weekend activity

interface TimeData {
  date: string
  value: number // minutes from midnight
  staffId: string
  staffName: string
  checkTime: Date
  ipAddress?: string
}

export class AnomalyDetector {
  private readonly Z_SCORE_THRESHOLD = 2.5 // Standard deviations
  private readonly IQR_MULTIPLIER = 1.5

  /**
   * Detect outliers using Z-Score method
   */
  detectZScoreOutliers(data: TimeData[], type: 'IN' | 'OUT'): AnomalyRecord[] {
    if (data.length < 5) return [] // Need minimum data points

    // Calculate mean and standard deviation
    const values = data.map(d => d.value)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)

    if (stdDev === 0) return [] // No variation

    // Find outliers
    const anomalies: AnomalyRecord[] = []

    data.forEach(record => {
      const zScore = Math.abs((record.value - mean) / stdDev)

      if (zScore > this.Z_SCORE_THRESHOLD) {
        const isEarly = record.value < mean
        const anomalyType = type === 'IN'
          ? (isEarly ? 'OUTLIER_CHECK_IN_EARLY' : 'OUTLIER_CHECK_IN_LATE')
          : (isEarly ? 'OUTLIER_CHECK_OUT_EARLY' : 'OUTLIER_CHECK_OUT_LATE')

        const severity = zScore > 3.5 ? 'HIGH' : zScore > 3 ? 'MEDIUM' : 'LOW'

        const expectedMean = this.minutesToTime(Math.round(mean))
        const expectedMin = this.minutesToTime(Math.round(mean - stdDev))
        const expectedMax = this.minutesToTime(Math.round(mean + stdDev))
        const actualTime = this.minutesToTime(record.value)

        const direction = isEarly ? '일찍' : '늦게'
        const actionType = type === 'IN' ? '출근' : '퇴근'

        anomalies.push({
          id: `zscore-${record.staffId}-${record.date}`,
          type: anomalyType,
          staffId: record.staffId,
          staffName: record.staffName,
          date: record.date,
          checkTime: record.checkTime.toISOString(),
          severity,
          score: zScore,
          description: `${actionType} 시간이 평균보다 ${Math.round(zScore)}σ ${direction} 기록되었습니다.`,
          expectedRange: `${expectedMin} - ${expectedMax} (평균: ${expectedMean})`,
          actualValue: actualTime,
        })
      }
    })

    return anomalies
  }

  /**
   * Detect outliers using IQR (Interquartile Range) method
   * More robust to extreme outliers than Z-score
   */
  detectIQROutliers(data: TimeData[], type: 'IN' | 'OUT'): AnomalyRecord[] {
    if (data.length < 4) return []

    const values = data.map(d => d.value).sort((a, b) => a - b)

    // Calculate quartiles
    const q1Index = Math.floor(values.length * 0.25)
    const q3Index = Math.floor(values.length * 0.75)
    const q1 = values[q1Index]
    const q3 = values[q3Index]
    const iqr = q3 - q1

    if (iqr === 0) return []

    const lowerBound = q1 - this.IQR_MULTIPLIER * iqr
    const upperBound = q3 + this.IQR_MULTIPLIER * iqr

    const anomalies: AnomalyRecord[] = []

    data.forEach(record => {
      if (record.value < lowerBound || record.value > upperBound) {
        const isEarly = record.value < q1
        const anomalyType = type === 'IN'
          ? (isEarly ? 'OUTLIER_CHECK_IN_EARLY' : 'OUTLIER_CHECK_IN_LATE')
          : (isEarly ? 'OUTLIER_CHECK_OUT_EARLY' : 'OUTLIER_CHECK_OUT_LATE')

        const deviation = isEarly ? (lowerBound - record.value) : (record.value - upperBound)
        const severity = deviation > iqr * 2 ? 'HIGH' : deviation > iqr ? 'MEDIUM' : 'LOW'

        const actionType = type === 'IN' ? '출근' : '퇴근'
        const direction = isEarly ? '일찍' : '늦게'

        anomalies.push({
          id: `iqr-${record.staffId}-${record.date}`,
          type: anomalyType,
          staffId: record.staffId,
          staffName: record.staffName,
          date: record.date,
          checkTime: record.checkTime.toISOString(),
          severity,
          score: deviation / iqr,
          description: `${actionType} 시간이 정상 범위를 벗어났습니다 (IQR 기반).`,
          expectedRange: `${this.minutesToTime(Math.round(lowerBound))} - ${this.minutesToTime(Math.round(upperBound))}`,
          actualValue: this.minutesToTime(record.value),
        })
      }
    })

    return anomalies
  }

  /**
   * Detect consecutive pattern anomalies
   */
  detectConsecutivePatterns(
    records: Array<{ date: string; isLate?: boolean; isEarly?: boolean; staffId: string; staffName: string }>,
    threshold: number = 3
  ): AnomalyRecord[] {
    const anomalies: AnomalyRecord[] = []

    // Sort by date
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))

    // Track consecutive lates
    let consecutiveLate = 0
    let lateStartDate = ''

    // Track consecutive early leaves
    let consecutiveEarly = 0
    let earlyStartDate = ''

    sorted.forEach((record, index) => {
      // Check consecutive lates
      if (record.isLate) {
        if (consecutiveLate === 0) {
          lateStartDate = record.date
        }
        consecutiveLate++

        if (consecutiveLate >= threshold) {
          anomalies.push({
            id: `consecutive-late-${record.staffId}-${record.date}`,
            type: 'PATTERN_CONSECUTIVE_LATE',
            staffId: record.staffId,
            staffName: record.staffName,
            date: record.date,
            checkTime: new Date(record.date).toISOString(),
            severity: consecutiveLate >= 5 ? 'HIGH' : 'MEDIUM',
            score: consecutiveLate,
            description: `${consecutiveLate}일 연속 지각이 감지되었습니다.`,
            context: {
              startDate: lateStartDate,
              endDate: record.date,
              count: consecutiveLate,
            },
          })
        }
      } else {
        consecutiveLate = 0
      }

      // Check consecutive early leaves
      if (record.isEarly) {
        if (consecutiveEarly === 0) {
          earlyStartDate = record.date
        }
        consecutiveEarly++

        if (consecutiveEarly >= threshold) {
          anomalies.push({
            id: `consecutive-early-${record.staffId}-${record.date}`,
            type: 'PATTERN_CONSECUTIVE_EARLY',
            staffId: record.staffId,
            staffName: record.staffName,
            date: record.date,
            checkTime: new Date(record.date).toISOString(),
            severity: consecutiveEarly >= 5 ? 'HIGH' : 'MEDIUM',
            score: consecutiveEarly,
            description: `${consecutiveEarly}일 연속 조퇴가 감지되었습니다.`,
            context: {
              startDate: earlyStartDate,
              endDate: record.date,
              count: consecutiveEarly,
            },
          })
        }
      } else {
        consecutiveEarly = 0
      }
    })

    return anomalies
  }

  /**
   * Detect missing check-out pattern
   */
  detectMissingCheckouts(
    records: Array<{ date: string; hasCheckIn: boolean; hasCheckOut: boolean; staffId: string; staffName: string }>,
    threshold: number = 0.3 // 30% missing
  ): AnomalyRecord[] {
    const withCheckIn = records.filter(r => r.hasCheckIn)
    const missingCheckOut = withCheckIn.filter(r => !r.hasCheckOut)

    const missingRate = withCheckIn.length > 0 ? missingCheckOut.length / withCheckIn.length : 0

    if (missingRate >= threshold && missingCheckOut.length >= 3) {
      const staffId = records[0]?.staffId
      const staffName = records[0]?.staffName

      return [{
        id: `missing-checkout-${staffId}`,
        type: 'PATTERN_MISSING_CHECKOUT',
        staffId,
        staffName,
        date: records[records.length - 1].date,
        checkTime: new Date().toISOString(),
        severity: missingRate > 0.5 ? 'HIGH' : 'MEDIUM',
        score: missingRate,
        description: `퇴근 체크를 자주 누락합니다 (${Math.round(missingRate * 100)}%).`,
        context: {
          totalDays: withCheckIn.length,
          missingDays: missingCheckOut.length,
          missingRate: Math.round(missingRate * 100),
        },
      }]
    }

    return []
  }

  /**
   * Detect IP address anomalies
   */
  detectIPAnomalies(
    records: Array<{ date: string; ipAddress: string; staffId: string; staffName: string; checkTime: Date }>
  ): AnomalyRecord[] {
    // Group by IP and count
    const ipCounts = new Map<string, number>()
    records.forEach(record => {
      const count = ipCounts.get(record.ipAddress) || 0
      ipCounts.set(record.ipAddress, count + 1)
    })

    // Find most common IP
    let mostCommonIP = ''
    let maxCount = 0
    ipCounts.forEach((count, ip) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonIP = ip
      }
    })

    // Detect records from unusual IPs (used only 1-2 times)
    const anomalies: AnomalyRecord[] = []
    const processedDates = new Set<string>()

    records.forEach(record => {
      const ipCount = ipCounts.get(record.ipAddress) || 0
      const isUnusual = ipCount <= 2 && record.ipAddress !== mostCommonIP

      if (isUnusual && !processedDates.has(record.date)) {
        processedDates.add(record.date)
        anomalies.push({
          id: `ip-anomaly-${record.staffId}-${record.date}`,
          type: 'PATTERN_IP_ANOMALY',
          staffId: record.staffId,
          staffName: record.staffName,
          date: record.date,
          checkTime: record.checkTime.toISOString(),
          severity: 'LOW',
          score: 1 / ipCount,
          description: `비정상적인 IP 주소에서 출퇴근 기록 (${record.ipAddress}).`,
          context: {
            unusualIP: record.ipAddress,
            usualIP: mostCommonIP,
            ipUsageCount: ipCount,
          },
        })
      }
    })

    return anomalies
  }

  /**
   * Convert minutes from midnight to HH:MM format
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }

  /**
   * Deduplicate anomalies (keep highest severity)
   */
  deduplicateAnomalies(anomalies: AnomalyRecord[]): AnomalyRecord[] {
    const grouped = new Map<string, AnomalyRecord[]>()

    anomalies.forEach(anomaly => {
      const key = `${anomaly.staffId}-${anomaly.date}-${anomaly.type}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(anomaly)
    })

    const deduplicated: AnomalyRecord[] = []
    grouped.forEach(group => {
      // Keep the one with highest severity and score
      const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
      group.sort((a, b) => {
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
        if (severityDiff !== 0) return severityDiff
        return b.score - a.score
      })
      deduplicated.push(group[0])
    })

    return deduplicated
  }
}
