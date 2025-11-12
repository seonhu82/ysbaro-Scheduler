import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    // 해당 월의 시작일과 종료일
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    // 연차 신청 조회
    const applications = await prisma.leaveApplication.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            email: true,
            departmentName: true,
            categoryName: true
          }
        },
        link: {
          select: {
            id: true,
            year: true,
            month: true,
            token: true,
            status: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    // 의사 스케줄 조회
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        schedule: {
          clinicId: session.user.clinicId
        },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        doctor: {
          select: {
            name: true,
            shortName: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    })

    // 날짜별로 그룹화
    const groupedByDate: Record<string, any[]> = {}

    applications.forEach(app => {
      const dateKey = app.date.toISOString().split('T')[0]
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = []
      }
      groupedByDate[dateKey].push(app)
    })

    // 날짜별 의사 스케줄 그룹화
    const doctorSchedulesByDate: Record<string, any[]> = {}
    doctorSchedules.forEach(ds => {
      const dateKey = ds.date.toISOString().split('T')[0]
      if (!doctorSchedulesByDate[dateKey]) {
        doctorSchedulesByDate[dateKey] = []
      }
      doctorSchedulesByDate[dateKey].push({
        doctorName: ds.doctor.name,
        doctorShortName: ds.doctor.shortName,
        hasNightShift: ds.hasNightShift
      })
    })

    return successResponse({
      applications: groupedByDate,
      doctorSchedules: doctorSchedulesByDate
    })
  } catch (error) {
    console.error('Calendar view error:', error)
    return errorResponse('Failed to fetch calendar data', 500)
  }
}
