import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkCategoryAvailability } from '@/lib/services/category-slot-service'
import { fairnessValidationService } from '@/lib/services/fairness-validation-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { date, type } = await request.json()

    // 1. Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token }
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 404 }
      )
    }

    // 2. Link에서 연도/월 확인 후 staff 조회 (기존 신청이 있다면)
    const existingApplication = await prisma.leaveApplication.findFirst({
      where: { linkId: link.id },
      include: { staff: true }
    })

    let staffId: string
    let clinicId: string

    if (existingApplication) {
      staffId = existingApplication.staff.id
      clinicId = existingApplication.staff.clinicId
    } else {
      // 기존 신청이 없으면 token을 통한 staff 매핑 필요
      // TODO: ApplicationLink와 Staff 연결 방법 재검토 필요
      return NextResponse.json(
        { success: false, error: 'No staff found for this link' },
        { status: 404 }
      )
    }

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

    // 6. 직원 정보 조회
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      )
    }

    // 7. 구분별 슬롯 확인
    const categoryCheck = await checkCategoryAvailability(
      clinicId,
      applicationDate,
      requiredStaff,
      staff.categoryName || ''
    )

    // 8. 신청 생성
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
