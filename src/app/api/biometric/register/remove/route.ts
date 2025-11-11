import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 생체인증 등록 해제
export async function POST(request: NextRequest) {
  try {
    const { staffId } = await request.json();

    if (!staffId) {
      return NextResponse.json(
        { error: '직원 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 직원 존재 확인
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 생체인증 정보 삭제
    const updatedStaff = await prisma.staff.update({
      where: { id: staffId },
      data: {
        biometricEnabled: false,
        biometricPublicKey: null,
        biometricCredentialId: null,
        biometricCounter: 0,
        biometricRegisteredAt: null,
        biometricDeviceType: null,
      },
    });

    console.log(`✅ [생체인증] 등록 해제: ${staff.name}`);

    return NextResponse.json({
      success: true,
      message: '생체인증 등록이 해제되었습니다.',
      staff: {
        id: updatedStaff.id,
        name: updatedStaff.name,
        biometricEnabled: false,
      },
    });
  } catch (error) {
    console.error('❌ [생체인증] 등록 해제 실패:', error);
    return NextResponse.json(
      { error: '생체인증 등록 해제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
