/**
 * 공개 스케줄 조회 인증 API
 * POST: PIN으로 직원 인증 (기본값: 생년월일 YYMMDD)
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
        { success: false, error: '직원과 PIN 번호를 입력해주세요' },
        { status: 400 }
      )
    }

    // Token으로 link 조회
    const link = await prisma.scheduleViewLink.findUnique({
      where: { token: params.token },
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

    // PIN 설정 여부에 따라 인증 방식 결정
    if (staff.pinCode) {
      // PIN이 설정되어 있으면 PIN으로만 인증
      if (pinCode.length !== 6) {
        return NextResponse.json(
          { success: false, error: 'PIN 번호는 6자리입니다' },
          { status: 400 }
        )
      }

      if (staff.pinCode === pinCode) {
        console.log('✅ PIN 인증 성공')
      } else {
        console.log('❌ PIN 불일치')
        return NextResponse.json(
          { success: false, error: 'PIN 번호가 올바르지 않습니다' },
          { status: 401 }
        )
      }
    } else {
      // PIN이 없으면 생년월일로 인증
      if (pinCode.length !== 6) {
        return NextResponse.json(
          { success: false, error: '생년월일은 6자리입니다 (YYMMDD)' },
          { status: 400 }
        )
      }
      const inputYear = parseInt(pinCode.substring(0, 2))
      const inputMonth = parseInt(pinCode.substring(2, 4))
      const inputDay = parseInt(pinCode.substring(4, 6))

      // 2000년대/1900년대 판단 (00-49는 2000년대, 50-99는 1900년대)
      const fullYear = inputYear >= 50 ? 1900 + inputYear : 2000 + inputYear

      const staffBirthDate = new Date(staff.birthDate)

      // UTC 기준으로 날짜 가져오기 (타임존 문제 방지)
      const dbYear = staffBirthDate.getUTCFullYear()
      const dbMonth = staffBirthDate.getUTCMonth() + 1
      const dbDay = staffBirthDate.getUTCDate()

      console.log('🔐 생년월일 인증 시도:', {
        staffName: staff.name,
        inputBirthDate: pinCode,
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
