import { prisma } from '@/lib/prisma'

export type DayTypeValue =
  | 'WEEKDAY'
  | 'SATURDAY'
  | 'SUNDAY'
  | 'HOLIDAY'
  | 'HOLIDAY_ADJACENT'
  | 'HOLIDAY_ADJACENT_SUNDAY'

/**
 * 날짜의 유형을 분류합니다.
 * 하나의 날짜가 여러 유형을 가질 수 있습니다.
 * 예: 5월 3일(토요일, 공휴일 전날) = ['SATURDAY', 'HOLIDAY_ADJACENT']
 */
export async function classifyDayType(
  clinicId: string,
  date: Date
): Promise<DayTypeValue[]> {
  const types: DayTypeValue[] = []
  const dayOfWeek = date.getDay()

  // 1. 기본 요일 분류
  if (dayOfWeek === 0) {
    types.push('SUNDAY')
  } else if (dayOfWeek === 6) {
    types.push('SATURDAY')
  } else {
    types.push('WEEKDAY')
  }

  // 2. 공휴일 체크 (일요일 제외)
  if (dayOfWeek !== 0) {
    const dateStart = new Date(date)
    dateStart.setHours(0, 0, 0, 0)

    const dateEnd = new Date(date)
    dateEnd.setHours(23, 59, 59, 999)

    const holiday = await prisma.holiday.findFirst({
      where: {
        clinicId,
        date: {
          gte: dateStart,
          lte: dateEnd
        }
      }
    })

    if (holiday) {
      types.push('HOLIDAY')
    }
  }

  // 3. 공휴일 전후일 체크
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)

  const tomorrow = new Date(date)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  // 어제나 내일이 공휴일인지 확인 (일요일 제외한 공휴일만)
  const adjacentHolidays = await prisma.holiday.findMany({
    where: {
      clinicId,
      OR: [
        {
          date: {
            gte: yesterday,
            lte: new Date(yesterday.setHours(23, 59, 59, 999))
          }
        },
        {
          date: {
            gte: tomorrow,
            lte: new Date(tomorrow.setHours(23, 59, 59, 999))
          }
        }
      ]
    }
  })

  // 어제나 내일 중 일요일이 아닌 공휴일이 있는지 확인
  const hasAdjacentHoliday = adjacentHolidays.some(h => {
    const holidayDayOfWeek = h.date.getDay()
    return holidayDayOfWeek !== 0 // 일요일이 아닌 공휴일
  })

  if (hasAdjacentHoliday) {
    if (dayOfWeek === 0) {
      // 공휴일 전후 일요일
      types.push('HOLIDAY_ADJACENT_SUNDAY')
    } else {
      // 공휴일 전후일
      types.push('HOLIDAY_ADJACENT')
    }
  }

  return types
}

/**
 * DayType 배열을 Prisma DayType enum 값으로 변환
 * 우선순위: HOLIDAY > HOLIDAY_ADJACENT > SATURDAY > SUNDAY > WEEKDAY
 */
export function getPrimaryDayType(types: DayTypeValue[]): DayTypeValue {
  if (types.includes('HOLIDAY')) return 'HOLIDAY'
  if (types.includes('HOLIDAY_ADJACENT_SUNDAY')) return 'HOLIDAY_ADJACENT_SUNDAY'
  if (types.includes('HOLIDAY_ADJACENT')) return 'HOLIDAY_ADJACENT'
  if (types.includes('SATURDAY')) return 'SATURDAY'
  if (types.includes('SUNDAY')) return 'SUNDAY'
  return 'WEEKDAY'
}
