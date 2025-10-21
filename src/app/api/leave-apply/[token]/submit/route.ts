// 연차/오프 신청 API ⭐⭐⭐ 중요!

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDatesInWeek, isSunday, getWeekOfMonth } from '@/lib/date-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await request.json()
    const { staffPin, date, leaveType } = body

    if (!staffPin || !date || !leaveType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 1. 신청 링크 확인
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
      include: {
        slotLimits: true,
        clinic: {
          include: {
            ruleSettings: true,
            holidays: true,
          },
        },
      },
    })

    if (!link || link.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Invalid or inactive link' },
        { status: 400 }
      )
    }

    // 만료 확인
    if (new Date() > link.expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Link has expired' },
        { status: 400 }
      )
    }

    // 2. 직원 확인 (PIN 검증)
    const staff = await prisma.staff.findFirst({
      where: {
        clinicId: link.clinicId,
        pin: staffPin,
        isActive: true,
      },
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: 'Invalid staff PIN' },
        { status: 401 }
      )
    }

    const leaveDate = new Date(date)
    const ruleSettings = link.clinic.ruleSettings

    // 3. 날짜 유효성 체크
    const year = leaveDate.getFullYear()
    const month = leaveDate.getMonth() + 1

    if (year !== link.year || month !== link.month) {
      return NextResponse.json(
        { success: false, error: 'Date is not in the application period' },
        { status: 400 }
      )
    }

    // 4. ⭐ 휴일 체크 (일요일 또는 공휴일)
    if (ruleSettings?.preventSundayOff && isSunday(leaveDate)) {
      return NextResponse.json(
        { success: false, error: 'Cannot apply for leave on Sunday' },
        { status: 400 }
      )
    }

    // 공휴일 체크
    if (ruleSettings?.preventHolidayOff) {
      const holiday = link.clinic.holidays.find(
        (h) =>
          h.date.getFullYear() === year &&
          h.date.getMonth() + 1 === month &&
          h.date.getDate() === leaveDate.getDate()
      )

      if (holiday) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot apply for leave on holiday: ${holiday.name}`,
          },
          { status: 400 }
        )
      }
    }

    // 5. ⭐ 주간 오프 제한 (주 2일)
    const weekOfMonth = getWeekOfMonth(leaveDate)
    const weekDates = getDatesInWeek(year, month, weekOfMonth)
    const weekStart = weekDates[0]
    const weekEnd = weekDates[weekDates.length - 1]

    const existingWeeklyApplications = await prisma.leaveApplication.count({
      where: {
        staffId: staff.id,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
    })

    const maxWeeklyOffs = ruleSettings?.maxWeeklyOffs || 2

    if (existingWeeklyApplications >= maxWeeklyOffs) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum ${maxWeeklyOffs} days per week allowed`,
        },
        { status: 400 }
      )
    }

    // 6. 슬롯 제한 확인
    const slotLimit = link.slotLimits.find(
      (s) =>
        s.date.getFullYear() === year &&
        s.date.getMonth() + 1 === month &&
        s.date.getDate() === leaveDate.getDate()
    )

    if (slotLimit && slotLimit.currentSlots >= slotLimit.maxSlots) {
      return NextResponse.json(
        { success: false, error: 'No available slots for this date' },
        { status: 400 }
      )
    }

    // 7. 중복 신청 확인
    const existing = await prisma.leaveApplication.findFirst({
      where: {
        staffId: staff.id,
        date: leaveDate,
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Application already exists for this date' },
        { status: 400 }
      )
    }

    // 8. 트랜잭션으로 생성
    const result = await prisma.$transaction(async (tx) => {
      // 신청 생성
      const application = await tx.leaveApplication.create({
        data: {
          clinicId: link.clinicId,
          linkId: link.id,
          staffId: staff.id,
          date: leaveDate,
          leaveType,
          status: 'PENDING',
        },
      })

      // 슬롯 카운트 증가
      if (slotLimit) {
        await tx.slotLimit.update({
          where: { id: slotLimit.id },
          data: {
            currentSlots: {
              increment: 1,
            },
          },
        })
      }

      // 9. 알림 생성
      await tx.notification.create({
        data: {
          clinicId: link.clinicId,
          type: 'LEAVE_SUBMITTED',
          title: '연차 신청',
          message: `${staff.name}님이 ${leaveDate.toLocaleDateString('ko-KR')} ${
            leaveType === 'ANNUAL' ? '연차' : '오프'
          }를 신청했습니다.`,
        },
      })

      return application
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Leave application error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
