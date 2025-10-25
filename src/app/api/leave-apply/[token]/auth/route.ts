/**
 * 공개 연차/오프 신청 인증 API
 * POST /api/leave-apply/[token]/auth
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { birthDate, pin } = await request.json()

    if (!birthDate || !pin) {
      return NextResponse.json(
        { success: false, error: '생년월일과 PIN을 입력해주세요' },
        { status: 400 }
      )
    }

    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
      include: { staff: true }
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 직원 조회 및 인증
    let staff
    if (link.staffId) {
      // 특정 직원용 링크
      if (!link.staff) {
        return NextResponse.json(
          { success: false, error: '직원 정보를 찾을 수 없습니다' },
          { status: 404 }
        )
      }

      // birthDate와 PIN 확인
      if (link.staff.birthDate !== birthDate || link.staff.pin !== pin) {
        return NextResponse.json(
          { success: false, error: '생년월일 또는 PIN이 올바르지 않습니다' },
          { status: 401 }
        )
      }

      staff = link.staff
    } else {
      // 전체 직원용 링크 - birthDate와 PIN으로 직원 찾기
      staff = await prisma.staff.findFirst({
        where: {
          clinicId: link.clinicId,
          birthDate,
          pin,
          isActive: true
        }
      })

      if (!staff) {
        return NextResponse.json(
          { success: false, error: '생년월일 또는 PIN이 올바르지 않습니다' },
          { status: 401 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        staffId: staff.id,
        staffName: staff.name,
        categoryName: staff.categoryName,
        clinicId: staff.clinicId
      }
    })
  } catch (error: any) {
    console.error('인증 오류:', error)
    return NextResponse.json(
      { success: false, error: '인증 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
