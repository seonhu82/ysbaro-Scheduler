/**
 * PIN 번호 재설정 API
 * POST /api/leave-apply/[token]/reset-pin
 *
 * 세 가지 방법 지원:
 * 1. 보안 질문으로 재설정 (staffId, securityAnswer, newPinCode)
 * 2. 생년월일로 재설정 (staffId, birthDate, newPinCode)
 * 3. 관리자 토큰으로 재설정 (staffId, adminToken, newPinCode) - TODO
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { staffId, birthDate, securityAnswer, newPinCode } = await request.json()

    if (!staffId || !newPinCode) {
      return NextResponse.json(
        { success: false, error: '직원 ID와 새 PIN 번호를 입력해주세요' },
        { status: 400 }
      )
    }

    // 인증 방법이 하나는 제공되어야 함
    if (!birthDate && !securityAnswer) {
      return NextResponse.json(
        { success: false, error: '생년월일 또는 보안 답변을 입력해주세요' },
        { status: 400 }
      )
    }

    // 생년월일 형식 확인 (6자리)
    if (birthDate && !/^\d{6}$/.test(birthDate)) {
      return NextResponse.json(
        { success: false, error: '생년월일은 6자리 숫자여야 합니다 (YYMMDD)' },
        { status: 400 }
      )
    }

    // PIN 번호 유효성 검사 (6자리 숫자)
    if (!/^\d{6}$/.test(newPinCode)) {
      return NextResponse.json(
        { success: false, error: 'PIN 번호는 6자리 숫자여야 합니다' },
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

    // 인증 방식 선택
    let authMethod = ''

    if (securityAnswer) {
      // 보안 질문으로 인증
      if (!staff.securityQuestion || !staff.securityAnswer) {
        return NextResponse.json(
          {
            success: false,
            error: '보안 질문이 설정되지 않았습니다. 생년월일로 재설정해주세요.'
          },
          { status: 400 }
        )
      }

      // 보안 답변 확인 (대소문자 구분 없이, 공백 제거 후 비교)
      const normalizedStaffAnswer = staff.securityAnswer.trim().toLowerCase()
      const normalizedInputAnswer = securityAnswer.trim().toLowerCase()

      if (normalizedStaffAnswer !== normalizedInputAnswer) {
        console.log('❌ PIN 재설정 실패: 보안 답변 불일치')
        return NextResponse.json(
          { success: false, error: '보안 답변이 올바르지 않습니다' },
          { status: 401 }
        )
      }

      authMethod = '보안 질문'
      console.log('✅ 보안 질문 인증 성공')
    } else if (birthDate) {
      // 생년월일로 인증
      const inputYear = parseInt(birthDate.substring(0, 2))
      const inputMonth = parseInt(birthDate.substring(2, 4))
      const inputDay = parseInt(birthDate.substring(4, 6))

      // 2000년대/1900년대 판단
      const fullYear = inputYear >= 50 ? 1900 + inputYear : 2000 + inputYear

      const staffBirthDate = new Date(staff.birthDate)
      const dbYear = staffBirthDate.getUTCFullYear()
      const dbMonth = staffBirthDate.getUTCMonth() + 1
      const dbDay = staffBirthDate.getUTCDate()

      // 생년월일 검증
      if (fullYear !== dbYear || inputMonth !== dbMonth || inputDay !== dbDay) {
        console.log('❌ PIN 재설정 실패: 생년월일 불일치')
        return NextResponse.json(
          { success: false, error: '생년월일이 올바르지 않습니다' },
          { status: 401 }
        )
      }

      authMethod = '생년월일'
      console.log('✅ 생년월일 인증 성공')
    }

    // PIN 번호 재설정
    await prisma.staff.update({
      where: { id: staffId },
      data: { pinCode: newPinCode }
    })

    console.log(`✅ PIN 재설정 완료 (${authMethod}): ${staff.name} (${staffId})`)

    return NextResponse.json({
      success: true,
      message: 'PIN 번호가 재설정되었습니다'
    })
  } catch (error: any) {
    console.error('PIN 재설정 오류:', error)
    return NextResponse.json(
      { success: false, error: 'PIN 재설정 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
