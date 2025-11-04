/**
 * 원장 패턴 적용 API
 * POST: 활성화된 원장 패턴을 월간 스케줄에 적용
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { year, month, scheduleId } = body

    if (!year || !month) {
      return badRequestResponse('Year and month are required')
    }

    // 1. 활성화된 원장 패턴 조회
    const activePatterns = await prisma.doctorPattern.findMany({
      where: {
        isActive: true,
        doctor: {
          clinicId: session.user.clinicId,
          isActive: true
        }
      },
      include: {
        doctor: true,
        days: {
          orderBy: {
            dayOfWeek: 'asc'
          }
        }
      }
    })

    if (activePatterns.length === 0) {
      return badRequestResponse('No active doctor patterns found')
    }

    // 2. 스케줄 조회 또는 생성
    let schedule
    if (scheduleId) {
      schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId }
      })

      if (!schedule) {
        return badRequestResponse('Schedule not found')
      }

      if (schedule.clinicId !== session.user.clinicId) {
        return unauthorizedResponse()
      }
    } else {
      // 이전 달 Staff 테이블의 편차를 previousMonthFairness로 설정
      const staffList = await prisma.staff.findMany({
        where: {
          clinicId: session.user.clinicId,
          isActive: true,
          departmentName: '진료실'
        },
        select: {
          id: true,
          fairnessScoreTotalDays: true,
          fairnessScoreNight: true,
          fairnessScoreWeekend: true,
          fairnessScoreHoliday: true,
          fairnessScoreHolidayAdjacent: true
        }
      })

      const previousMonthFairness: Record<string, any> = {}
      for (const staff of staffList) {
        previousMonthFairness[staff.id] = {
          total: staff.fairnessScoreTotalDays,
          night: staff.fairnessScoreNight,
          weekend: staff.fairnessScoreWeekend,
          holiday: staff.fairnessScoreHoliday,
          holidayAdjacent: staff.fairnessScoreHolidayAdjacent
        }
      }

      console.log(`📊 이전 달 편차를 previousMonthFairness에 저장: ${staffList.length}명`)

      // 새 스케줄 생성
      schedule = await prisma.schedule.create({
        data: {
          clinicId: session.user.clinicId,
          year,
          month,
          status: 'DRAFT',
          previousMonthFairness
        }
      })
    }

    // 3. 해당 월의 모든 날짜 생성
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)
    const daysInMonth = endDate.getDate()

    // 4. 휴업일 조회
    const holidays = await prisma.holiday.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    const holidayDates = new Set(
      holidays.map(h => h.date.toISOString().split('T')[0])
    )

    // 5. 각 날짜에 원장 패턴 적용
    const assignmentsToCreate = []

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay()
      const dateKey = date.toISOString().split('T')[0]

      // 휴업일은 건너뛰기
      if (holidayDates.has(dateKey)) {
        continue
      }

      // 각 원장의 패턴에 따라 배치
      for (const pattern of activePatterns) {
        const dayPattern = pattern.days.find(d => d.dayOfWeek === dayOfWeek)

        if (dayPattern && dayPattern.isWorkday) {
          assignmentsToCreate.push({
            scheduleId: schedule.id,
            date,
            doctorId: pattern.doctorId,
            hasNightShift: dayPattern.hasNightShift
          })
        }
      }
    }

    // 6. 기존 원장 배치 삭제 (덮어쓰기)
    await prisma.scheduleDoctor.deleteMany({
      where: {
        scheduleId: schedule.id
      }
    })

    // 7. 새로운 배치 생성
    if (assignmentsToCreate.length > 0) {
      await prisma.scheduleDoctor.createMany({
        data: assignmentsToCreate.map(a => ({
          scheduleId: a.scheduleId,
          date: a.date,
          doctorId: a.doctorId,
          hasNightShift: a.hasNightShift
        }))
      })
    }

    // 8. 생성된 배치 조회
    const assignments = await prisma.scheduleDoctor.findMany({
      where: {
        scheduleId: schedule.id
      },
      include: {
        doctor: {
          select: {
            name: true,
            specialization: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    return successResponse(
      {
        scheduleId: schedule.id,
        year: schedule.year,
        month: schedule.month,
        assignmentsCount: assignments.length,
        patternsApplied: activePatterns.length,
        assignments: assignments.map(a => ({
          date: a.date.toISOString().split('T')[0],
          doctorName: a.doctor?.name,
          hasNightShift: a.hasNightShift
        }))
      },
      'Doctor patterns applied successfully'
    )
  } catch (error) {
    console.error('Pattern apply error:', error)
    return errorResponse('Failed to apply doctor patterns', 500)
  }
}
