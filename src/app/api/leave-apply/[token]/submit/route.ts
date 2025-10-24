import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCategoryAvailability } from '@/lib/services/category-slot-service'
import { fairnessValidationService } from '@/lib/services/fairness-validation-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { date, type, pin } = await request.json()

    if (!pin) {
      return NextResponse.json(
        { success: false, error: 'PIN is required' },
        { status: 400 }
      )
    }

    // 1. Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
      include: { staff: true }
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 404 }
      )
    }

    // 2. PIN으로 직원 조회
    let staff
    if (link.staffId) {
      // 특정 직원용 링크
      if (!link.staff) {
        return NextResponse.json(
          { success: false, error: 'Staff not found' },
          { status: 404 }
        )
      }
      if (link.staff.pin !== pin) {
        return NextResponse.json(
          { success: false, error: 'Invalid PIN' },
          { status: 401 }
        )
      }
      staff = link.staff
    } else {
      // 전체 직원용 링크
      staff = await prisma.staff.findFirst({
        where: {
          clinicId: link.clinicId,
          pin,
          isActive: true
        }
      })

      if (!staff) {
        return NextResponse.json(
          { success: false, error: 'Invalid PIN' },
          { status: 401 }
        )
      }
    }

    const staffId = staff.id
    const clinicId = staff.clinicId
    const applicationDate = new Date(date)

    // 3. DailySlot 조회
    const dailySlot = await prisma.dailySlot.findFirst({
      where: {
        date: applicationDate,
        week: { clinicId }
      },
      include: {
        week: true
      }
    })

    if (!dailySlot) {
      return NextResponse.json(
        { success: false, error: 'No schedule for this date' },
        { status: 400 }
      )
    }

    const requiredStaff = dailySlot.requiredStaff

    // doctorSchedule에서 hasNightShift 확인
    const doctorSchedule = dailySlot.doctorSchedule as any
    const hasNightShift = doctorSchedule?.night_shift || false

    // 4. 공휴일 확인
    const dayOfWeek = applicationDate.getDay()
    let isHoliday = dayOfWeek === 0

    if (!isHoliday) {
      const holiday = await prisma.holiday.findFirst({
        where: {
          clinicId,
          date: applicationDate
        }
      })
      isHoliday = !!holiday
    }

    // 5. 형평성 검증
    const fairnessCheck = await fairnessValidationService.validateOffApplication(
      clinicId,
      staffId,
      applicationDate,
      hasNightShift,
      isHoliday
    )

    if (!fairnessCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: fairnessCheck.message,
        reason: fairnessCheck.reason,
        details: fairnessCheck.details
      }, { status: 400 })
    }

    // 6. 구분별 슬롯 확인
    const categoryCheck = await checkCategoryAvailability(
      clinicId,
      applicationDate,
      requiredStaff,
      staff.categoryName || ''
    )

    // 7. 신청 생성
    let status: 'PENDING' | 'ON_HOLD' = 'PENDING'
    let holdReason: string | null = null

    if (categoryCheck.shouldHold) {
      status = 'ON_HOLD'
      holdReason = categoryCheck.message
    }

    const newApplication = await prisma.leaveApplication.create({
      data: {
        clinicId,
        staffId,
        date: applicationDate,
        leaveType: type,
        status,
        holdReason,
        linkId: link.id
      }
    })

    return NextResponse.json({
      success: true,
      application: newApplication,
      status,
      message: status === 'ON_HOLD'
        ? `보류되었습니다: ${holdReason}`
        : '신청이 완료되었습니다.'
    })

  } catch (error) {
    console.error('Leave application error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit application' },
      { status: 500 }
    )
  }
}
