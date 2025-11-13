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

    // 연차/오프 신청 내역 조회 (최근 6개월)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const applications = await prisma.leaveApplication.findMany({
      where: {
        staffId,
        clinicId: link.clinicId,
        date: {
          gte: sixMonthsAgo
        }
      },
      select: {
        id: true,
        date: true,
        leaveType: true,
        status: true,
        reason: true,
        createdAt: true
      },
      orderBy: {
        date: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: applications
    })
  } catch (error: any) {
    console.error('신청 내역 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '신청 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
