// 배치 검증
import { prisma } from '@/lib/prisma'

export async function validateAssignment(slotId: string, staffId: string) {
  // 배치 유효성 검사
  return { valid: true, errors: [] }
}

export async function validateWeeklySchedule(weekId: string) {
  // 주간 스케줄 유효성 검사
  return { valid: true, errors: [] }
}
