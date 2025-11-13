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
    const rank = searchParams.get('rank')
    const department = searchParams.get('department')
    const category = searchParams.get('category')
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // 직원 목록 조회
    const staffWhere: any = {
      clinicId: session.user.clinicId,
      isActive: true
    }

    if (rank && rank !== 'all') {
      staffWhere.rank = rank
    }

    if (department && department !== 'all') {
      staffWhere.departmentName = department
    }

    if (category && category !== 'all') {
      staffWhere.categoryName = category
    }

    const staffList = await prisma.staff.findMany({
      where: staffWhere,
      select: {
        id: true,
        name: true,
        rank: true,
        email: true,
        phoneNumber: true
      },
      orderBy: [
        { rank: 'asc' },
        { name: 'asc' }
      ]
    })

    // 각 직원의 연차 통계 및 최근 신청 조회
    const staffData = await Promise.all(
      staffList.map(async (staff) => {
        // 해당 연도의 연차 신청
        const startDate = new Date(year, 0, 1)
        const endDate = new Date(year, 11, 31)

        const applications = await prisma.leaveApplication.findMany({
          where: {
            staffId: staff.id,
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            link: {
              select: {
                year: true,
                month: true
              }
            }
          },
          orderBy: {
            date: 'desc'
          }
        })

        // 통계 계산
        const statistics = {
          total: applications.length,
          pending: applications.filter(a => a.status === 'PENDING').length,
          confirmed: applications.filter(a => a.status === 'CONFIRMED').length,
          cancelled: applications.filter(a => a.status === 'CANCELLED').length,
          onHold: applications.filter(a => a.status === 'ON_HOLD').length,
          annual: applications.filter(a => a.leaveType === 'ANNUAL').length,
          off: applications.filter(a => a.leaveType === 'OFF').length
        }

        // 최근 신청 5건
        const recentApplications = applications.slice(0, 5).map(app => ({
          id: app.id,
          date: app.date.toISOString(),
          leaveType: app.leaveType,
          status: app.status,
          year: app.link.year,
          month: app.link.month
        }))

        return {
          ...staff,
          statistics,
          recentApplications
        }
      })
    )

    return successResponse(staffData)
  } catch (error) {
    console.error('Staff view error:', error)
    return errorResponse('Failed to fetch staff data', 500)
  }
}
