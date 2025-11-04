import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/kakao-settings
 * 카카오톡 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const settings = await prisma.kakaoSettings.findUnique({
      where: { clinicId: session.user.clinicId }
    })

    // 기본 설정 반환
    const defaultSettings = {
      javascriptKey: '',
      leaveApplicationTemplate: `안녕하세요!

연차/오프 신청 기간이 시작되었습니다.
아래 링크를 통해 희망하시는 날짜를 신청해주세요.

📅 신청 링크: {link}

✅ 이름과 생년월일 6자리로 인증 후 신청 가능합니다.
✅ 마감 기한 내에 신청해주세요.

감사합니다.`,
      useDefaultTemplate: true,
    }

    return NextResponse.json({
      success: true,
      data: settings || defaultSettings
    })
  } catch (error) {
    console.error('GET /api/kakao-settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/kakao-settings
 * 카카오톡 설정 저장
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { javascriptKey, leaveApplicationTemplate, useDefaultTemplate } = body

    const settings = await prisma.kakaoSettings.upsert({
      where: { clinicId: session.user.clinicId },
      create: {
        clinicId: session.user.clinicId,
        javascriptKey,
        leaveApplicationTemplate,
        useDefaultTemplate: useDefaultTemplate ?? true,
      },
      update: {
        javascriptKey,
        leaveApplicationTemplate,
        useDefaultTemplate: useDefaultTemplate ?? true,
      }
    })

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('POST /api/kakao-settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
