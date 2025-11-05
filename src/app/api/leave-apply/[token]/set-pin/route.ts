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
    const { staffId, pinCode, securityQuestion, securityAnswer } = await request.json()

    if (!staffId || !pinCode) {
      return NextResponse.json(
        { success: false, error: '직원 ID와 PIN 번호를 입력해주세요' },
        { status: 400 }
      )
    }

    // PIN 번호 유효성 검사 (6자리 숫자)
    if (!/^\d{6}$/.test(pinCode)) {
      return NextResponse.json(
        { success: false, error: 'PIN 번호는 6자리 숫자여야 합니다' },
        { status: 400 }
      )
    }

    // 보안 질문/답변 유효성 검사 (선택사항)
    if (securityQuestion && !securityAnswer) {
      return NextResponse.json(
        { success: false, error: '보안 질문을 선택하면 답변도 입력해야 합니다' },
        { status: 400 }
      )
    }

    if (!securityQuestion && securityAnswer) {
      return NextResponse.json(
        { success: false, error: '보안 답변을 입력하면 질문도 선택해야 합니다' },
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

    // PIN 번호 및 보안 질문/답변 업데이트
    const updateData: any = { pinCode }

    if (securityQuestion && securityAnswer) {
      updateData.securityQuestion = securityQuestion
      updateData.securityAnswer = securityAnswer
      console.log(`✅ PIN 및 보안 질문 설정: ${staff.name} (${staffId})`)
    } else {
      console.log(`✅ PIN 설정 (보안 질문 없음): ${staff.name} (${staffId})`)
    }

    await prisma.staff.update({
      where: { id: staffId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      message: securityQuestion
        ? 'PIN 번호와 보안 질문이 설정되었습니다'
        : 'PIN 번호가 설정되었습니다'
    })
  } catch (error: any) {
    console.error('PIN 설정 오류:', error)
    return NextResponse.json(
      { success: false, error: 'PIN 설정 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
