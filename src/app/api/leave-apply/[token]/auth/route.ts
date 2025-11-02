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
    const { staffId, birthDate } = await request.json()

    if (!staffId || !birthDate) {
      return NextResponse.json(
        { success: false, error: '직원과 생년월일을 입력해주세요' },
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

    // 생년월일 형식 변환 및 확인 (6자리 YYMMDD)
    if (birthDate.length !== 6) {
      return NextResponse.json(
        { success: false, error: '생년월일은 6자리로 입력해주세요 (YYMMDD)' },
        { status: 400 }
      )
    }

    const inputYear = parseInt(birthDate.substring(0, 2))
    const inputMonth = parseInt(birthDate.substring(2, 4))
    const inputDay = parseInt(birthDate.substring(4, 6))

    // 2000년대/1900년대 판단 (00-49는 2000년대, 50-99는 1900년대)
    const fullYear = inputYear >= 50 ? 1900 + inputYear : 2000 + inputYear

    const staffBirthDate = new Date(staff.birthDate)

    // 날짜 비교 (연/월/일만)
    if (
      fullYear !== staffBirthDate.getFullYear() ||
      inputMonth !== staffBirthDate.getMonth() + 1 ||
      inputDay !== staffBirthDate.getDate()
    ) {
      return NextResponse.json(
        { success: false, error: '생년월일이 올바르지 않습니다' },
        { status: 401 }
      )
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
