/**
 * 일별 스케줄 상세 API
 * GET /api/schedule/daily-detail?date=2025-01-15
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateStr = searchParams.get('date')

    if (!dateStr) {
      return NextResponse.json({ success: false, error: 'Date required' }, { status: 400 })
    }

    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const clinicId = (session.user as any).clinicId

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year,
        month,
        status: { in: ['DRAFT', 'DEPLOYED'] }
      },
      include: {
        weeks: {
          include: {
            days: {
              where: {
                date: {
                  gte: new Date(date.setHours(0, 0, 0, 0)),
                  lt: new Date(date.setHours(23, 59, 59, 999))
                }
              },
              include: {
                doctorCombination: {
                  include: {
                    doctors: true
                  }
                },
                slots: {
                  include: {
                    category: true,
                    assignments: {
                      include: {
                        staff: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    // 공휴일 확인
    const holiday = await prisma.holiday.findFirst({
      where: {
        clinicId,
        date: {
          gte: new Date(dateStr + 'T00:00:00Z'),
          lt: new Date(dateStr + 'T23:59:59Z')
        }
      }
    })

    // 연차/오프 신청 조회
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        leaveDate: {
          gte: new Date(dateStr + 'T00:00:00Z'),
          lt: new Date(dateStr + 'T23:59:59Z')
        }
      },
      include: {
        staff: true
      }
    })

    // 해당 날짜 데이터 찾기
    let dayData = null
    if (schedule) {
      for (const week of schedule.weeks) {
        if (week.days.length > 0) {
          dayData = week.days[0]
          break
        }
      }
    }

    if (!dayData) {
      return NextResponse.json({
        success: true,
        data: {
          date: dateStr,
          doctors: [],
          staff: [],
          leaves: [],
          isHoliday: !!holiday,
          holidayName: holiday?.name
        }
      })
    }

    // 원장 목록
    const doctors = dayData.doctorCombination?.doctors.map(d => ({
      id: d.id,
      name: d.name,
      hasNightShift: dayData.slots.some(s => s.isNightShift)
    })) || []

    // 직원 목록 (카테고리별)
    const staffList: Array<{
      id: string
      name: string
      category: string
      isAssigned: boolean
      leaveType?: 'ANNUAL' | 'OFF'
      leaveStatus?: string
    }> = []

    for (const slot of dayData.slots) {
      for (const assignment of slot.assignments) {
        // 연차/오프 확인
        const staffLeave = leaves.find(l => l.staffId === assignment.staffId)

        staffList.push({
          id: assignment.staff.id,
          name: assignment.staff.name || '직원',
          category: slot.category?.name || '미분류',
          isAssigned: true,
          leaveType: staffLeave?.leaveType,
          leaveStatus: staffLeave?.status
        })
      }
    }

    // 연차/오프 목록
    const leavesList = leaves.map(l => ({
      staffId: l.staff.id,
      staffName: l.staff.name || '직원',
      type: l.leaveType,
      status: l.status
    }))

    return NextResponse.json({
      success: true,
      data: {
        date: dateStr,
        doctors,
        staff: staffList,
        leaves: leavesList,
        isHoliday: !!holiday,
        holidayName: holiday?.name
      }
    })
  } catch (error) {
    console.error('Error fetching daily detail:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
