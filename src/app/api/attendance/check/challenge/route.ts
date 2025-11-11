import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// 출퇴근 인증을 위한 Challenge 생성
export async function POST(request: NextRequest) {
  try {
    const { staffId } = await request.json();

    if (!staffId) {
      return NextResponse.json(
        { error: '직원 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 직원 확인 및 생체인증 등록 상태 확인
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        biometricEnabled: true,
        biometricCredentialId: true,
        biometricCounter: true,
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!staff.biometricEnabled || !staff.biometricCredentialId) {
      return NextResponse.json(
        { error: '생체인증이 등록되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 랜덤 Challenge 생성
    const challenge = crypto.randomBytes(32);
    const challengeBase64 = challenge.toString('base64url');

    // WebAuthn 인증 옵션 생성
    const authenticationOptions = {
      challenge: challengeBase64,
      timeout: 60000,
      rpId: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
      allowCredentials: [
        {
          type: 'public-key' as const,
          id: staff.biometricCredentialId,
        },
      ],
      userVerification: 'required' as const,
    };

    return NextResponse.json({
      success: true,
      options: authenticationOptions,
      staffInfo: {
        id: staff.id,
        name: staff.name,
      },
    });
  } catch (error) {
    console.error('❌ [출퇴근] Challenge 생성 실패:', error);
    return NextResponse.json(
      { error: 'Challenge 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
