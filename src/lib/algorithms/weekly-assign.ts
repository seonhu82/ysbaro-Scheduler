// 주간 배치
import { prisma } from '@/lib/prisma'

export async function createWeeklySchedule(clinicId: string, startDate: Date) {
  // 주간 스케줄 생성
  return { success: true, weekId: '' }
}
