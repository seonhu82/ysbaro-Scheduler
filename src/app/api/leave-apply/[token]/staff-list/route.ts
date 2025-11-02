/**
 * 공개 연차/오프 신청 - 직원 목록 API
 * GET /api/leave-apply/[token]/staff-list
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 해당 병원의 활성화된 직원 목록 조회
    const staffList = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        departmentName: true,
      },
      orderBy: [
        { departmentName: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: staffList,
    })
  } catch (error: any) {
    console.error('직원 목록 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '직원 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
