// 연차 서비스 ⭐⭐

import { prisma } from '@/lib/prisma'

export async function checkSlotAvailability(linkId: string, date: Date) {
  // TODO: 슬롯 가용성 확인
}

export async function checkWeeklyOffLimit(linkId: string, staffId: string, date: Date) {
  // TODO: 주 2일 오프 제한 확인
}

export async function isHoliday(clinicId: string, date: Date): Promise<boolean> {
  const dayOfWeek = date.getDay()
  if (dayOfWeek === 0) return true // 일요일

  const holiday = await prisma.holiday.findFirst({
    where: {
      clinicId,
      date: {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    },
  })

  return !!holiday
}
