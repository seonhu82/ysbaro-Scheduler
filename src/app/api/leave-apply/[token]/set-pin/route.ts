/**
 * PIN 번호 설정/변경 API
 * POST /api/leave-apply/[token]/set-pin
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { staffId, pinCode } = await request.json()

    if (!staffId || !pinCode) {
      return NextResponse.json(
        { success: false, error: '직원 ID와 PIN 번호를 입력해주세요' },
        { status: 400 }
      )
    }

    // PIN 번호 유효성 검사 (4자리 숫자)
    if (!/^\d{4}$/.test(pinCode)) {
      return NextResponse.json(
        { success: false, error: 'PIN 번호는 4자리 숫자여야 합니다' },
        { status: 400 }
      )
    }

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

    // 직원 조회
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        clinicId: link.clinicId,
        isActive: true,
      }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // PIN 번호 업데이트
    await prisma.staff.update({
      where: { id: staffId },
      data: { pinCode }
    })

    console.log(`✅ PIN 설정 완료: ${staff.name} (${staffId})`)

    return NextResponse.json({
      success: true,
      message: 'PIN 번호가 설정되었습니다'
    })
  } catch (error: any) {
    console.error('PIN 설정 오류:', error)
    return NextResponse.json(
      { success: false, error: 'PIN 설정 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
