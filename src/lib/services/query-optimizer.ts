/**
 * 데이터베이스 쿼리 최적화 헬퍼
 *
 * N+1 쿼리 문제 해결을 위한 배치 로딩 유틸리티
 */

import { prisma } from '@/lib/prisma'

/**
 * 직원 목록에 대한 형평성 점수를 배치로 조회
 *
 * Before (N+1):
 * - 1번: 직원 목록 조회
 * - N번: 각 직원의 형평성 점수 조회 (N = 직원 수)
 *
 * After (Batch):
 * - 1번: 직원 목록 조회
 * - 1번: 모든 직원의 형평성 점수 한번에 조회
 */
export async function batchLoadFairnessScores(
  staffIds: string[],
  year: number,
  month: number
): Promise<Map<string, any[]>> {
  if (staffIds.length === 0) {
    return new Map()
  }

  const scores = await prisma.fairnessScore.findMany({
    where: {
      staffId: { in: staffIds },
      year,
      month
    },
    orderBy: {
      staffId: 'asc'
    }
  })

  // Map으로 그룹화
  const scoreMap = new Map<string, any[]>()
  for (const score of scores) {
    if (!scoreMap.has(score.staffId)) {
      scoreMap.set(score.staffId, [])
    }
    scoreMap.get(score.staffId)!.push(score)
  }

  return scoreMap
}

/**
 * 직원 목록에 대한 형평성 점수를 여러 달치 배치로 조회
 */
export async function batchLoadFairnessScoresMultiMonth(
  staffIds: string[],
  year: number,
  startMonth: number,
  endMonth: number
): Promise<Map<string, any[]>> {
  if (staffIds.length === 0) {
    return new Map()
  }

  const scores = await prisma.fairnessScore.findMany({
    where: {
      staffId: { in: staffIds },
      year,
      month: {
        gte: startMonth,
        lte: endMonth
      }
    },
    orderBy: [
      { staffId: 'asc' },
      { month: 'asc' }
    ]
  })

  const scoreMap = new Map<string, any[]>()
  for (const score of scores) {
    if (!scoreMap.has(score.staffId)) {
      scoreMap.set(score.staffId, [])
    }
    scoreMap.get(score.staffId)!.push(score)
  }

  return scoreMap
}

/**
 * 직원 목록에 대한 연차 신청을 배치로 조회
 */
export async function batchLoadLeaveApplications(
  staffIds: string[],
  startDate: Date,
  endDate: Date,
  status?: string[]
): Promise<Map<string, any[]>> {
  if (staffIds.length === 0) {
    return new Map()
  }

  const whereClause: any = {
    staffId: { in: staffIds },
    date: {
      gte: startDate,
      lte: endDate
    }
  }

  if (status) {
    whereClause.status = { in: status }
  }

  const applications = await prisma.leaveApplication.findMany({
    where: whereClause,
    orderBy: [
      { staffId: 'asc' },
      { date: 'asc' }
    ]
  })

  const appMap = new Map<string, any[]>()
  for (const app of applications) {
    if (!appMap.has(app.staffId)) {
      appMap.set(app.staffId, [])
    }
    appMap.get(app.staffId)!.push(app)
  }

  return appMap
}

/**
 * 직원 목록에 대한 근무 배정을 배치로 조회
 */
export async function batchLoadStaffAssignments(
  staffIds: string[],
  startDate: Date,
  endDate: Date
): Promise<Map<string, any[]>> {
  if (staffIds.length === 0) {
    return new Map()
  }

  const assignments = await prisma.staffAssignment.findMany({
    where: {
      staffId: { in: staffIds },
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: [
      { staffId: 'asc' },
      { date: 'asc' }
    ]
  })

  const assignmentMap = new Map<string, any[]>()
  for (const assignment of assignments) {
    if (!assignmentMap.has(assignment.staffId)) {
      assignmentMap.set(assignment.staffId, [])
    }
    assignmentMap.get(assignment.staffId)!.push(assignment)
  }

  return assignmentMap
}

/**
 * 여러 주차의 WeekInfo와 관련 DailySlot을 배치로 조회
 */
export async function batchLoadWeeksWithSlots(
  clinicId: string,
  year: number,
  months: number[]
): Promise<any[]> {
  const weeks = await prisma.weekInfo.findMany({
    where: {
      clinicId,
      year,
      month: { in: months }
    },
    include: {
      dailySlots: {
        orderBy: {
          date: 'asc'
        },
        include: {
          staffAssignments: {
            include: {
              staff: {
                select: {
                  id: true,
                  name: true,
                  categoryName: true,
                  department: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: {
      weekStart: 'asc'
    }
  })

  return weeks
}

/**
 * 활성 직원 목록과 최근 형평성 점수를 함께 조회
 */
export async function loadActiveStaffWithFairness(
  clinicId: string,
  year: number,
  month: number
): Promise<any[]> {
  const staff = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    include: {
      fairnessScores: {
        where: {
          year,
          month
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  })

  return staff
}

/**
 * 특정 기간의 직원별 연차 신청 통계를 배치로 계산
 */
export async function batchCalculateLeaveStats(
  clinicId: string,
  year: number,
  month: number
): Promise<Map<string, { total: number; confirmed: number; pending: number; onHold: number }>> {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  // 원시 쿼리로 집계 (매우 빠름)
  const stats: any[] = await prisma.$queryRaw`
    SELECT
      staffId,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'ON_HOLD' THEN 1 ELSE 0 END) as onHold
    FROM LeaveApplication
    WHERE clinicId = ${clinicId}
      AND date >= ${startDate}
      AND date <= ${endDate}
    GROUP BY staffId
  `

  const statsMap = new Map()
  for (const stat of stats) {
    statsMap.set(stat.staffId, {
      total: Number(stat.total),
      confirmed: Number(stat.confirmed),
      pending: Number(stat.pending),
      onHold: Number(stat.onHold)
    })
  }

  return statsMap
}

/**
 * 특정 기간의 직원별 근무 통계를 배치로 계산
 */
export async function batchCalculateWorkStats(
  clinicId: string,
  year: number,
  month: number
): Promise<Map<string, { total: number; nightShifts: number; weekendShifts: number; offDays: number }>> {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  // DailySlot의 dayOfWeek를 확인하여 주말 여부 판단
  const stats: any[] = await prisma.$queryRaw`
    SELECT
      sa.staffId,
      COUNT(*) as total,
      SUM(CASE WHEN ds.doctorSchedule::jsonb->>'night_shift' = 'true' THEN 1 ELSE 0 END) as nightShifts,
      SUM(CASE WHEN EXTRACT(DOW FROM ds.date) IN (0, 6) THEN 1 ELSE 0 END) as weekendShifts,
      SUM(CASE WHEN sa.shiftType = 'OFF' THEN 1 ELSE 0 END) as offDays
    FROM StaffAssignment sa
    JOIN DailySlot ds ON sa.dailySlotId = ds.id
    JOIN WeekInfo w ON ds.weekId = w.id
    WHERE w.clinicId = ${clinicId}
      AND ds.date >= ${startDate}
      AND ds.date <= ${endDate}
    GROUP BY sa.staffId
  `

  const statsMap = new Map()
  for (const stat of stats) {
    statsMap.set(stat.staffId, {
      total: Number(stat.total),
      nightShifts: Number(stat.nightShifts),
      weekendShifts: Number(stat.weekendShifts),
      offDays: Number(stat.offDays)
    })
  }

  return statsMap
}

/**
 * 데이터 로더 클래스 - DataLoader 패턴 구현
 *
 * 같은 요청을 여러 번 하는 대신, 배치로 모아서 한 번에 처리
 */
export class BatchDataLoader {
  private fairnessScoreQueue: Map<string, { staffId: string; year: number; month: number }> = new Map()
  private fairnessScorePromises: Map<string, Promise<any[]>> = new Map()
  private batchTimeout: NodeJS.Timeout | null = null

  /**
   * 형평성 점수 로드 (자동 배치)
   */
  async loadFairnessScore(staffId: string, year: number, month: number): Promise<any[]> {
    const key = `${staffId}-${year}-${month}`

    // 이미 요청 중이면 같은 Promise 반환
    if (this.fairnessScorePromises.has(key)) {
      return this.fairnessScorePromises.get(key)!
    }

    // 배치 큐에 추가
    this.fairnessScoreQueue.set(key, { staffId, year, month })

    // Promise 생성 및 저장
    const promise = new Promise<any[]>((resolve) => {
      // 다음 이벤트 루프에서 배치 실행
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.executeFairnessScoreBatch()
        }, 0)
      }

      // 결과를 기다리는 리스너 등록
      this.fairnessScorePromises.set(key, promise)
    })

    return promise
  }

  private async executeFairnessScoreBatch() {
    const queue = Array.from(this.fairnessScoreQueue.values())
    this.fairnessScoreQueue.clear()
    this.batchTimeout = null

    if (queue.length === 0) return

    // 모든 staffId 추출
    const staffIds = [...new Set(queue.map(q => q.staffId))]

    // 배치로 한 번에 조회
    const scoreMap = await batchLoadFairnessScores(
      staffIds,
      queue[0].year,
      queue[0].month
    )

    // 각 요청에 대한 결과 반환
    for (const item of queue) {
      const key = `${item.staffId}-${item.year}-${item.month}`
      const scores = scoreMap.get(item.staffId) || []

      // Promise resolve
      const promise = this.fairnessScorePromises.get(key)
      if (promise) {
        // @ts-ignore
        promise.resolve(scores)
        this.fairnessScorePromises.delete(key)
      }
    }
  }
}

/**
 * 글로벌 데이터 로더 인스턴스
 */
export const dataLoader = new BatchDataLoader()
