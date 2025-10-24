import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateCategorySlots } from '@/lib/services/category-slot-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token }
    })

    if (!link) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    const clinicId = link.clinicId
    const start = new Date(startDate)
    const end = new Date(endDate)

    // 해당 기간의 DailySlot 조회
    const dailySlots = await prisma.dailySlot.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        },
        week: { clinicId }
      },
      include: {
        week: true
      },
      orderBy: {
        date: 'asc'
      }
    })

    // 구분 목록 조회
    const categories = await prisma.staffCategory.findMany({
      where: { clinicId },
      orderBy: { order: 'asc' }
    })

    const categoryNames = categories.map(c => c.name)

    // 각 날짜별 구분별 슬롯 현황 계산
    const statusByDate = await Promise.all(
      dailySlots.map(async (slot) => {
        const categorySlots = await calculateCategorySlots(
          clinicId,
          slot.date,
          slot.requiredStaff,
          categoryNames
        )

        const doctorSchedule = slot.doctorSchedule as any

        return {
          date: slot.date,
          dayOfWeek: slot.date.getDay(),
          requiredStaff: slot.requiredStaff,
          hasNightShift: doctorSchedule?.night_shift || false,
          categorySlots,
          totalAvailable: Object.values(categorySlots).reduce(
            (sum, cat) => sum + cat.available,
            0
          ),
          offAssigned: slot.offAssigned,
          annualAssigned: slot.annualAssigned
        }
      })
    )

    return NextResponse.json({
      success: true,
      status: statusByDate
    })

  } catch (error) {
    console.error('Get status error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}
