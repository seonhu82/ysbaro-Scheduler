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

    console.log('👤 직원 조회:', staff ? `${staff.name} (ID: ${staff.id})` : '없음')

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 입력값 길이 확인 (4자리 PIN 또는 6자리 생년월일)
    if (birthDate.length !== 4 && birthDate.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'PIN(4자리) 또는 생년월일(6자리)을 입력해주세요' },
        { status: 400 }
      )
    }

    // PIN 번호로 인증 시도 (4자리)
    if (birthDate.length === 4) {
      if (staff.pinCode && staff.pinCode === birthDate) {
        console.log('✅ PIN 인증 성공')
      } else {
        console.log('❌ PIN 불일치 또는 미설정')
        return NextResponse.json(
          { success: false, error: 'PIN 번호가 올바르지 않거나 설정되지 않았습니다' },
          { status: 401 }
        )
      }
    }
    // 생년월일로 인증 (6자리)
    else {
      const inputYear = parseInt(birthDate.substring(0, 2))
      const inputMonth = parseInt(birthDate.substring(2, 4))
      const inputDay = parseInt(birthDate.substring(4, 6))

      // 2000년대/1900년대 판단 (00-49는 2000년대, 50-99는 1900년대)
      const fullYear = inputYear >= 50 ? 1900 + inputYear : 2000 + inputYear

      const staffBirthDate = new Date(staff.birthDate)

      // UTC 기준으로 날짜 가져오기 (타임존 문제 방지)
      const dbYear = staffBirthDate.getUTCFullYear()
      const dbMonth = staffBirthDate.getUTCMonth() + 1
      const dbDay = staffBirthDate.getUTCDate()

      console.log('🔐 생년월일 인증 시도:', {
        staffName: staff.name,
        inputBirthDate: birthDate,
        inputYear: fullYear,
        inputMonth,
        inputDay,
        dbBirthDate: staff.birthDate,
        dbYear,
        dbMonth,
        dbDay,
      })

      // 날짜 비교 (연/월/일만, UTC 기준)
      if (
        fullYear !== dbYear ||
        inputMonth !== dbMonth ||
        inputDay !== dbDay
      ) {
        console.log('❌ 생년월일 불일치')
        return NextResponse.json(
          { success: false, error: '생년월일이 올바르지 않습니다' },
          { status: 401 }
        )
      }

      console.log('✅ 생년월일 인증 성공')
    }

    return NextResponse.json({
      success: true,
      data: {
        staffId: staff.id,
        staffName: staff.name,
        categoryName: staff.categoryName,
        clinicId: staff.clinicId,
        totalAnnualDays: staff.totalAnnualDays,
        usedAnnualDays: staff.usedAnnualDays,
        hasPinCode: !!staff.pinCode, // PIN 설정 여부
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
