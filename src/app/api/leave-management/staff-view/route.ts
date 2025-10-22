// 직원별뷰 데이터 - 직원별 연차 신청 통계 및 내역

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    // URL 쿼리 파라미터
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') // 특정 연도 필터
    const rankFilter = searchParams.get('rank') // 직급 필터

    // 전체 직원 조회 (활성 직원만)
    const whereStaff: any = {
      clinicId,
      isActive: true,
    }

    if (rankFilter) {
      whereStaff.rank = rankFilter
    }

    const staff = await prisma.staff.findMany({
      where: whereStaff,
      orderBy: [
        { rank: 'asc' },
        { name: 'asc' },
      ],
    })

    // 각 직원별 연차 통계 계산
    const staffData = await Promise.all(
      staff.map(async (member) => {
        // 연차 신청 조회 (연도 필터 적용)
        const whereApplications: any = {
          staffId: member.id,
        }

        if (year) {
          const yearNum = parseInt(year)
          whereApplications.date = {
            gte: new Date(yearNum, 0, 1),
            lte: new Date(yearNum, 11, 31, 23, 59, 59),
          }
        }

        const applications = await prisma.leaveApplication.findMany({
          where: whereApplications,
          include: {
            link: {
              select: {
                year: true,
                month: true,
              },
            },
          },
          orderBy: {
            date: 'desc',
          },
        })

        // 통계 계산
        const totalApplications = applications.length
        const pendingCount = applications.filter((a) => a.status === 'PENDING').length
        const confirmedCount = applications.filter((a) => a.status === 'CONFIRMED').length
        const cancelledCount = applications.filter((a) => a.status === 'CANCELLED').length
        const annualCount = applications.filter(
          (a) => a.leaveType === 'ANNUAL' && a.status === 'CONFIRMED'
        ).length
        const offCount = applications.filter(
          (a) => a.leaveType === 'OFF' && a.status === 'CONFIRMED'
        ).length

        return {
          id: member.id,
          name: member.name,
          rank: member.rank,
          email: member.email,
          phoneNumber: member.phoneNumber,
          statistics: {
            total: totalApplications,
            pending: pendingCount,
            confirmed: confirmedCount,
            cancelled: cancelledCount,
            annual: annualCount,
            off: offCount,
          },
          recentApplications: applications.slice(0, 5).map((app) => ({
            id: app.id,
            date: app.date.toISOString().split('T')[0],
            leaveType: app.leaveType,
            status: app.status,
            year: app.link.year,
            month: app.link.month,
          })),
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: staffData,
    })
  } catch (error) {
    console.error('GET /api/leave-management/staff-view error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
