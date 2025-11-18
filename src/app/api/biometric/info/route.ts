import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: 'staffId가 필요합니다.' },
        { status: 400 }
      )
    }

    // 직원 정보 및 생체인식 정보 조회
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        biometricEnabled: true,
        biometricDeviceType: true,
        biometricRegisteredAt: true,
      },
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        staffId: staff.id,
        staffName: staff.name,
        biometricEnabled: staff.biometricEnabled || false,
        biometricDeviceType: staff.biometricDeviceType,
        biometricRegisteredAt: staff.biometricRegisteredAt,
      },
    })
  } catch (error) {
    console.error('생체인식 정보 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
