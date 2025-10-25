/**
 * 배치 백업 및 복구 서비스
 *
 * 주간 배치의 백업, 복구, 변경 추적 기능을 제공합니다.
 */

import { prisma } from '@/lib/prisma'

/**
 * 주간 배치 백업 생성
 *
 * @param weekInfoId - 주차 정보 ID
 * @param backupType - 백업 유형
 * @param description - 백업 설명 (선택)
 * @param createdBy - 생성자 ID (선택)
 * @returns 백업 ID
 */
export async function createWeeklyAssignmentBackup(
  weekInfoId: string,
  backupType: 'AUTO_BEFORE_ASSIGN' | 'AUTO_AFTER_ASSIGN' | 'MANUAL' | 'BEFORE_LEAVE_CHANGE',
  description?: string,
  createdBy?: string
): Promise<string> {
  console.log(`\n💾 배치 백업 생성: ${backupType}`)

  // 현재 배치 데이터 조회
  const dailySlots = await prisma.dailySlot.findMany({
    where: {
      week: { id: weekInfoId }
    },
    include: {
      staffAssignments: {
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              categoryName: true
            }
          }
        }
      }
    },
    orderBy: { date: 'asc' }
  })

  // 배치 데이터를 JSON으로 변환
  const assignments: Record<string, Array<{ staffId: string; staffName: string; category: string | null }>> = {}

  for (const slot of dailySlots) {
    const dateKey = slot.date.toISOString().split('T')[0]
    assignments[dateKey] = slot.staffAssignments.map(a => ({
      staffId: a.staffId,
      staffName: a.staff.name,
      category: a.staff.categoryName
    }))
  }

  // 형평성 점수 스냅샷 조회
  const weekInfo = await prisma.weekInfo.findUnique({
    where: { id: weekInfoId },
    select: { year: true, month: true, clinicId: true }
  })

  if (!weekInfo) {
    throw new Error('WeekInfo를 찾을 수 없습니다')
  }

  const fairnessScores = await prisma.fairnessScore.findMany({
    where: {
      year: weekInfo.year,
      month: weekInfo.month,
      staff: {
        clinicId: weekInfo.clinicId
      }
    },
    include: {
      staff: {
        select: { id: true, name: true }
      }
    }
  })

  const fairnessSnapshot = fairnessScores.map(fs => ({
    staffId: fs.staffId,
    staffName: fs.staff.name,
    nightShiftCount: fs.nightShiftCount,
    weekendCount: fs.weekendCount,
    holidayCount: fs.holidayCount,
    holidayAdjacentCount: fs.holidayAdjacentCount
  }))

  // 백업 생성
  const backup = await prisma.weeklyAssignmentBackup.create({
    data: {
      weekInfoId,
      backupType,
      description,
      createdBy,
      assignments,
      fairnessScores: fairnessSnapshot
    }
  })

  console.log(`   ✅ 백업 생성 완료 (ID: ${backup.id})`)
  console.log(`      - 배치 날짜: ${Object.keys(assignments).length}일`)
  console.log(`      - 배치 인원: ${Object.values(assignments).flat().length}명`)
  console.log(`      - 형평성 점수: ${fairnessSnapshot.length}명`)

  return backup.id
}

/**
 * 백업에서 배치 복구
 *
 * @param backupId - 백업 ID
 * @param restoredBy - 복구 실행자 ID (선택)
 * @returns 복구 결과
 */
export async function restoreWeeklyAssignmentFromBackup(
  backupId: string,
  restoredBy?: string
): Promise<{
  success: boolean
  message: string
  restoredCount: number
}> {
  console.log(`\n🔄 백업에서 배치 복구 시작...`)

  // 백업 조회
  const backup = await prisma.weeklyAssignmentBackup.findUnique({
    where: { id: backupId },
    include: {
      weekInfo: true
    }
  })

  if (!backup) {
    throw new Error('백업을 찾을 수 없습니다')
  }

  console.log(`   백업 정보:`)
  console.log(`   - 유형: ${backup.backupType}`)
  console.log(`   - 생성일: ${backup.createdAt.toLocaleString('ko-KR')}`)
  console.log(`   - 설명: ${backup.description || '없음'}`)

  const assignments = backup.assignments as Record<string, Array<{ staffId: string; category: string | null }>>
  const { weekInfoId } = backup

  let restoredCount = 0

  // 트랜잭션으로 복구
  await prisma.$transaction(async (tx) => {
    // 1. 기존 배치 삭제
    const dailySlots = await tx.dailySlot.findMany({
      where: { week: { id: weekInfoId } },
      select: { id: true }
    })

    await tx.dailyStaffAssignment.deleteMany({
      where: {
        dailySlotId: { in: dailySlots.map(s => s.id) }
      }
    })

    console.log(`   ✅ 기존 배치 삭제 완료`)

    // 2. 백업 데이터 복원
    for (const [dateStr, staffList] of Object.entries(assignments)) {
      const date = new Date(dateStr)

      // DailySlot 찾기
      const slot = await tx.dailySlot.findFirst({
        where: {
          weekId: weekInfoId,
          date: {
            gte: new Date(date.setHours(0, 0, 0, 0)),
            lte: new Date(date.setHours(23, 59, 59, 999))
          }
        }
      })

      if (!slot) {
        console.log(`   ⚠️ ${dateStr}: DailySlot을 찾을 수 없음, 건너뜀`)
        continue
      }

      // 배치 복원
      for (const staff of staffList) {
        await tx.dailyStaffAssignment.create({
          data: {
            dailySlotId: slot.id,
            staffId: staff.staffId
          }
        })
        restoredCount++
      }

      console.log(`   ✅ ${dateStr}: ${staffList.length}명 복원`)
    }

    // 3. 백업 복구 정보 업데이트
    await tx.weeklyAssignmentBackup.update({
      where: { id: backupId },
      data: {
        restoredAt: new Date(),
        restoredBy
      }
    })

    // 4. WeekInfo 상태 업데이트
    await tx.weekInfo.update({
      where: { id: weekInfoId },
      data: {
        status: 'COMPLETED'
      }
    })
  })

  console.log(`\n✅ 복구 완료: 총 ${restoredCount}명 복원`)

  return {
    success: true,
    message: `백업에서 ${restoredCount}명의 배치를 복원했습니다`,
    restoredCount
  }
}

/**
 * 주차의 백업 목록 조회
 *
 * @param weekInfoId - 주차 정보 ID
 * @returns 백업 목록
 */
export async function getWeeklyBackups(weekInfoId: string) {
  return await prisma.weeklyAssignmentBackup.findMany({
    where: { weekInfoId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      backupType: true,
      description: true,
      createdAt: true,
      createdBy: true,
      restoredAt: true,
      restoredBy: true
    }
  })
}

/**
 * 백업 삭제 (오래된 백업 정리)
 *
 * @param weekInfoId - 주차 정보 ID
 * @param keepCount - 유지할 백업 개수 (기본 5개)
 */
export async function cleanupOldBackups(
  weekInfoId: string,
  keepCount: number = 5
): Promise<number> {
  const backups = await prisma.weeklyAssignmentBackup.findMany({
    where: { weekInfoId },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  })

  if (backups.length <= keepCount) {
    return 0
  }

  const toDelete = backups.slice(keepCount).map(b => b.id)

  const result = await prisma.weeklyAssignmentBackup.deleteMany({
    where: {
      id: { in: toDelete }
    }
  })

  console.log(`   🗑️ 오래된 백업 ${result.count}개 삭제`)

  return result.count
}

/**
 * 배치 데이터 비교
 *
 * @param weekInfoId - 주차 정보 ID
 * @param backupId - 비교할 백업 ID
 * @returns 차이점 목록
 */
export async function compareWithBackup(
  weekInfoId: string,
  backupId: string
): Promise<{
  added: Array<{ date: string; staffId: string; staffName: string }>
  removed: Array<{ date: string; staffId: string; staffName: string }>
  unchanged: number
}> {
  // 백업 데이터
  const backup = await prisma.weeklyAssignmentBackup.findUnique({
    where: { id: backupId }
  })

  if (!backup) {
    throw new Error('백업을 찾을 수 없습니다')
  }

  const backupAssignments = backup.assignments as Record<string, Array<{ staffId: string; staffName: string }>>

  // 현재 배치 데이터
  const currentSlots = await prisma.dailySlot.findMany({
    where: { week: { id: weekInfoId } },
    include: {
      staffAssignments: {
        include: {
          staff: { select: { id: true, name: true } }
        }
      }
    }
  })

  const currentAssignments: Record<string, Array<{ staffId: string; staffName: string }>> = {}
  for (const slot of currentSlots) {
    const dateKey = slot.date.toISOString().split('T')[0]
    currentAssignments[dateKey] = slot.staffAssignments.map(a => ({
      staffId: a.staffId,
      staffName: a.staff.name
    }))
  }

  // 차이점 계산
  const added: Array<{ date: string; staffId: string; staffName: string }> = []
  const removed: Array<{ date: string; staffId: string; staffName: string }> = []
  let unchanged = 0

  // 현재에는 있는데 백업에는 없는 것 = 추가됨
  for (const [date, staffList] of Object.entries(currentAssignments)) {
    const backupList = backupAssignments[date] || []
    const backupIds = new Set(backupList.map(s => s.staffId))

    for (const staff of staffList) {
      if (!backupIds.has(staff.staffId)) {
        added.push({ date, ...staff })
      } else {
        unchanged++
      }
    }
  }

  // 백업에는 있는데 현재에는 없는 것 = 제거됨
  for (const [date, staffList] of Object.entries(backupAssignments)) {
    const currentList = currentAssignments[date] || []
    const currentIds = new Set(currentList.map(s => s.staffId))

    for (const staff of staffList) {
      if (!currentIds.has(staff.staffId)) {
        removed.push({ date, ...staff })
      }
    }
  }

  return { added, removed, unchanged }
}
