/**
 * 내 연차/오프 신청 내역 API
 * GET: 직원의 연차/오프 신청 내역 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: '직원 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // 토큰으로 링크 조회
    const link = await prisma.scheduleViewLink.findUnique({
      where: { token: params.token }
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 만료 확인
    if (link.expiresAt && link.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: '만료된 링크입니다' },
        { status: 401 }
      )
    }

    // 직원 확인
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        clinicId: link.clinicId,
        isActive: true
      }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 현재 연도의 연차/오프 신청 내역 조회
    const currentYear = new Date().getFullYear()
    const startDate = new Date(currentYear, 0, 1)
    const endDate = new Date(currentYear, 11, 31)

    const applications = await prisma.leaveApplication.findMany({
      where: {
        staffId,
        clinicId: link.clinicId,
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
      onHold: applications.filter(a => a.status === 'ON_HOLD').length,
      rejected: applications.filter(a => a.status === 'REJECTED').length,
      annual: applications.filter(a => a.leaveType === 'ANNUAL').length,
      off: applications.filter(a => a.leaveType === 'OFF').length
    }

    // 신청 목록 (년-월별로 그룹화)
    const applicationsByMonth: Record<string, any[]> = {}

    applications.forEach(app => {
      const monthKey = `${app.link.year}-${String(app.link.month).padStart(2, '0')}`
      if (!applicationsByMonth[monthKey]) {
        applicationsByMonth[monthKey] = []
      }
      applicationsByMonth[monthKey].push({
        id: app.id,
        date: app.date.toISOString().split('T')[0],
        leaveType: app.leaveType,
        status: app.status,
        reason: app.reason,
        holdReason: app.holdReason,
        year: app.link.year,
        month: app.link.month
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        statistics,
        applicationsByMonth
      }
    })
  } catch (error: any) {
    console.error('신청 내역 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '신청 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
