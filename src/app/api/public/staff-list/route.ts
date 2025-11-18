/**
 * Public API: 태블릿 출퇴근 체크용 직원 목록 조회
 * 인증 없이 접근 가능하지만 최소한의 정보만 제공
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // 모든 클리닉의 활성 직원 목록 조회 (최소한의 정보만)
    // 실제 운영 환경에서는 clinic 식별을 위한 추가 매개변수가 필요할 수 있음
    const staff = await prisma.staff.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        departmentName: true,
        biometricEnabled: true,
      },
      orderBy: [
        { departmentName: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: staff,
    })
  } catch (error) {
    console.error('GET /api/public/staff-list error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
