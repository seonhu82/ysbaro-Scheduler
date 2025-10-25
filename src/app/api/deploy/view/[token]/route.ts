import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: 토큰으로 공개 스케줄 조회 (인증 불필요)
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    // 토큰으로 ScheduleViewLink 조회
    const viewLink = await prisma.scheduleViewLink.findUnique({
      where: { token },
      include: {
        clinic: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true
          }
        }
      }
    })

    if (!viewLink) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired link' },
        { status: 404 }
      )
    }

    // 만료 여부 확인
    if (viewLink.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This link has expired' },
        { status: 410 }
      )
    }

    // 해당 연월의 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId: viewLink.clinicId,
        year: viewLink.year,
        month: viewLink.month,
        status: {
          in: ['CONFIRMED', 'DEPLOYED']
        }
      },
      include: {
        doctors: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true,
                rank: true
              }
            }
          },
          orderBy: {
            date: 'asc'
          }
        },
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                rank: true
              }
            }
          },
          orderBy: {
            date: 'asc'
          }
        }
      }
    })

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // 날짜별로 스케줄 데이터 구성
    const scheduleByDate: Record<string, any> = {}

    // 의사 스케줄 추가
    schedule.doctors.forEach(doc => {
      const dateKey = doc.date.toISOString().split('T')[0]
      if (!scheduleByDate[dateKey]) {
        scheduleByDate[dateKey] = {
          date: dateKey,
          doctors: [],
          staff: []
        }
      }
      scheduleByDate[dateKey].doctors.push({
        id: doc.doctor.id,
        name: doc.doctor.name,
        rank: doc.doctor.rank,
        hasNightShift: doc.hasNightShift
      })
    })

    // 직원 스케줄 추가
    schedule.staffAssignments.forEach(assignment => {
      const dateKey = assignment.date.toISOString().split('T')[0]
      if (!scheduleByDate[dateKey]) {
        scheduleByDate[dateKey] = {
          date: dateKey,
          doctors: [],
          staff: []
        }
      }
      scheduleByDate[dateKey].staff.push({
        id: assignment.staff.id,
        name: assignment.staff.name,
        rank: assignment.staff.rank,
        shiftType: assignment.shiftType
      })
    })

    // 배열로 변환하고 날짜순 정렬
    const scheduleData = Object.values(scheduleByDate).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    )

    return NextResponse.json({
      success: true,
      data: {
        clinic: viewLink.clinic,
        year: viewLink.year,
        month: viewLink.month,
        schedule: scheduleData,
        expiresAt: viewLink.expiresAt.toISOString()
      }
    })
  } catch (error) {
    console.error('GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
