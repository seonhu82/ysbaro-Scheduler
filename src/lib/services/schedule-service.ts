// 스케줄 서비스
import { prisma } from '@/lib/prisma'

export class ScheduleService {
  constructor(private clinicId: string) {}

  async getMonthSchedule(year: number, month: number) {
    return prisma.schedule.findFirst({
      where: { clinicId: this.clinicId, year, month },
      include: { 
        doctors: { include: { doctor: true } },
        staffAssignments: { include: { staff: true } }
      }
    })
  }

  async createSchedule(data: any) {
    return prisma.schedule.create({ data })
  }
}
