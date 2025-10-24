// 패턴 서비스
import { prisma } from '@/lib/prisma'

export class PatternService {
  constructor(private clinicId: string) {}

  async getDayPatterns() {
    return prisma.doctorPattern.findMany({
      where: { 
        doctor: {
          clinicId: this.clinicId
        }
      },
      include: { days: true, doctor: true }
    })
  }
}
