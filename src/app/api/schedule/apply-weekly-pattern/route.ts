import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/utils/api-response'

/**
 * POST /api/schedule/apply-weekly-pattern
 * 주차별 주간 패턴을 적용하여 월간 스케줄 생성
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { year, month, weekPatterns } = body

    if (!year || !month || !weekPatterns) {
      return errorResponse('년도, 월, 주차별 패턴 정보가 필요합니다', 400)
    }

    const clinicId = session.user.clinicId

    // 이전 달에 배포된 스케줄 조회
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year

    const previousDeployedSchedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: prevYear,
        month: prevMonth,
        status: 'DEPLOYED'
      },
      select: {
        id: true
      }
    })

    // 이전 달 배포 스케줄의 실제 데이터를 스냅샷으로 저장
    let existingDates = new Set<string>()
    if (previousDeployedSchedule) {
      const previousScheduleDoctors = await prisma.scheduleDoctor.findMany({
        where: { scheduleId: previousDeployedSchedule.id },
        select: { date: true }
      })

      existingDates = new Set(
        previousScheduleDoctors.map(d => d.date.toISOString().split('T')[0])
      )

      console.log(`📸 이전 달 배포 데이터 스냅샷: ${existingDates.size}개 날짜`)
      if (existingDates.size > 0) {
        const dates = Array.from(existingDates).sort()
        console.log(`   범위: ${dates[0]} ~ ${dates[dates.length - 1]}`)
      }
    }

    // 휴무일 설정 조회
    const closedDaySettings = await prisma.closedDaySettings.findUnique({
      where: {
        clinicId,
      },
    })

    // 정기 휴무일 (0=일요일, 1=월요일, ..., 6=토요일)
    const regularClosedDays = closedDaySettings?.regularDays
      ? (closedDaySettings.regularDays as number[])
      : []

    // 해당 월의 스케줄 조회 또는 생성
    let schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month,
      },
    })

    if (!schedule) {
      schedule = await prisma.schedule.create({
        data: {
          clinicId,
          year,
          month,
          status: 'DRAFT',
          weekPatterns: weekPatterns, // 주차별 패턴 정보 저장
        },
      })
    } else {
      // 기존 스케줄이 있으면 weekPatterns 업데이트
      schedule = await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          weekPatterns: weekPatterns,
          updatedAt: new Date(),
        },
      })
    }

    // 기존 스케줄 데이터 삭제 (덮어쓰기)
    await prisma.scheduleDoctor.deleteMany({
      where: { scheduleId: schedule.id },
    })
    await prisma.staffAssignment.deleteMany({
      where: { scheduleId: schedule.id },
    })

    // 각 주차별로 패턴 적용
    const results = []
    for (const [weekNum, patternId] of Object.entries(weekPatterns)) {
      const week = parseInt(weekNum)

      // 주간 패턴 조회
      const pattern = await prisma.weeklyPattern.findUnique({
        where: { id: patternId as string },
        include: {
          days: {
            include: {
              combination: true,
            },
          },
        },
      })

      if (!pattern) {
        console.warn(`Pattern not found for week ${week}: ${patternId}`)
        continue
      }

      // 해당 주차의 날짜 계산
      const weekDates = getWeekDates(year, month, week)

      // 각 날짜에 대해 패턴 적용
      for (const date of weekDates) {
        const dayOfWeek = getDayOfWeek(date)
        const dayOfWeekNumber = date.getDay() // 0=일요일, 1=월요일, ..., 6=토요일
        const dateStr = date.toISOString().split('T')[0]

        // 이전 달 배포 데이터 스냅샷에 있는 날짜는 건너뛰기
        if (existingDates.has(dateStr)) {
          console.log(`🔒 Skipped ${dateStr} (${dayOfWeek}): 이전 달 배포 데이터 존재`)
          continue
        }

        // 정기 휴무일이면 건너뛰기
        if (regularClosedDays.includes(dayOfWeekNumber)) {
          console.log(`⏭️  Skipped ${dateStr} (${dayOfWeek}): 정기 휴무일`)
          continue
        }

        // 해당 요일의 패턴 조회
        const patternDay = pattern.days.find(
          (pd) => pd.dayOfWeek === dayOfWeek
        )

        if (!patternDay) {
          console.log(`⏭️  Skipped ${dateStr} (${dayOfWeek}): 패턴에 해당 요일 없음`)
          continue
        }

        if (!patternDay.combination) {
          console.log(`⏭️  Skipped ${dateStr} (${dayOfWeek}): 조합이 null (휴무일로 설정됨)`)
          continue
        }

        console.log(`📅 Processing ${dateStr} (${dayOfWeek}): ${patternDay.combination.name}`)

        const combination = patternDay.combination

        // 원장 스케줄 생성
        if (combination.doctors && Array.isArray(combination.doctors)) {
          for (const doctorName of combination.doctors) {
            // 원장 shortName으로 ID 조회
            const doctor = await prisma.doctor.findFirst({
              where: {
                clinicId,
                shortName: doctorName,
              },
            })

            if (doctor) {
              // 날짜를 UTC 기준 자정으로 변환 (타임존 문제 방지)
              const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))

              await prisma.scheduleDoctor.create({
                data: {
                  scheduleId: schedule.id,
                  doctorId: doctor.id,
                  date: utcDate,
                  hasNightShift: combination.hasNightShift || false,
                },
              })
              console.log(`✅ Saved doctor schedule: ${doctorName} on ${utcDate.toISOString().split('T')[0]}`)
            } else {
              console.warn(`⚠️ Doctor not found: ${doctorName} (clinicId: ${clinicId})`)
            }
          }
        }

        // 직원 스케줄은 나중에 자동 배치나 수동으로 설정
        // 여기서는 필요 인원 정보만 저장 가능하도록 메타데이터 저장
      }

      results.push({
        week,
        patternId,
        patternName: pattern.name,
        appliedDates: weekDates.length,
      })
    }

    // 스케줄 상태 업데이트
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        status: 'DRAFT',
        updatedAt: new Date(),
      },
    })

    return successResponse(
      {
        scheduleId: schedule.id,
        results,
      },
      '주간 패턴이 적용되었습니다'
    )
  } catch (error) {
    console.error('Apply weekly pattern error:', error)
    return errorResponse('주간 패턴 적용 중 오류가 발생했습니다', 500)
  }
}

/**
 * 특정 월의 주차별 날짜 계산 (일요일~토요일 완전한 주 단위)
 */
function getWeekDates(year: number, month: number, week: number): Date[] {
  const dates: Date[] = []

  // 해당 월의 1일
  const monthStart = new Date(year, month - 1, 1)
  const firstDayOfWeek = monthStart.getDay() // 0=일요일, 1=월요일, ..., 6=토요일

  // 해당 월의 1일이 속한 주의 일요일 날짜 계산
  // 예: 10월 1일이 수요일(3)이면, 1 - 3 = -2, 즉 9월 29일이 아니라 9월 28일(일요일)
  const firstSundayDate = 1 - firstDayOfWeek

  // 요청한 주차의 일요일 날짜 계산 (week는 1부터 시작)
  const weekStartDate = firstSundayDate + (week - 1) * 7

  // 해당 주의 7일 생성 (일요일~토요일)
  for (let i = 0; i < 7; i++) {
    const date = new Date(year, month - 1, weekStartDate + i)
    dates.push(date)
  }

  return dates
}

/**
 * 날짜에서 요일 문자열 반환
 */
function getDayOfWeek(date: Date): string {
  const days = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ]
  return days[date.getDay()]
}
