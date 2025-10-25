// 주간 배치
import { prisma } from '@/lib/prisma'
import { autoAssignSingleSlot } from './auto-assign'
import { classifyDayType, getPrimaryDayType } from '@/lib/utils/day-type-classifier'

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getDayOfWeekName(date: Date): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  return days[date.getDay()]
}

export async function createWeeklySchedule(clinicId: string, startDate: Date) {
  try {
    // 1. WeekInfo 생성
    const endDate = addDays(startDate, 6)
    const year = startDate.getFullYear()
    const month = startDate.getMonth() + 1
    const weekNumber = Math.ceil(startDate.getDate() / 7)

    const week = await prisma.weekInfo.create({
      data: {
        clinicId,
        year,
        month,
        weekNumber,
        weekStart: startDate,
        weekEnd: endDate,
        totalSlots: 0, // 계산 후 업데이트
        offTarget: 40,
        annualAvailable: 0,
        hasHoliday: false
      }
    })

    const createdSlots: string[] = []

    // 2. 7일간 DailySlot 생성
    for (let i = 0; i < 7; i++) {
      const date = addDays(startDate, i)
      const dayOfWeek = getDayOfWeekName(date)

      // 해당 요일의 조합 조회
      const combination = await prisma.doctorCombination.findFirst({
        where: { clinicId, dayOfWeek }
      })

      if (!combination) {
        console.log(`No combination found for ${dayOfWeek}, skipping...`)
        continue
      }

      // 날짜 유형 분류
      const dayTypes = await classifyDayType(clinicId, date)
      const primaryDayType = getPrimaryDayType(dayTypes)

      // DailySlot 생성
      const slot = await prisma.dailySlot.create({
        data: {
          weekId: week.id,
          date,
          requiredStaff: combination.requiredStaff,
          departmentRequiredStaff: combination.departmentRequiredStaff || {}, // 부서별 필요 인원
          dayType: primaryDayType,
          doctorSchedule: {
            doctors: combination.doctors,
            night_shift: combination.hasNightShift
          },
          availableSlots: 20 - combination.requiredStaff
        }
      })

      createdSlots.push(slot.id)

      // 각 슬롯 자동 배치
      const assignResult = await autoAssignSingleSlot(slot.id)

      if (!assignResult.success) {
        console.error(`Auto-assign failed for ${date.toISOString()}:`, assignResult.errors)
      }
    }

    return {
      success: true,
      weekId: week.id,
      slotsCreated: createdSlots.length
    }

  } catch (error) {
    console.error('Create weekly schedule error:', error)
    return {
      success: false,
      error: (error as Error).message
    }
  }
}
