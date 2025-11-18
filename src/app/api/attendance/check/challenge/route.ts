import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// 출퇴근 인증을 위한 Challenge 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId } = body || {};

    // 랜덤 Challenge 생성
    const challenge = crypto.randomBytes(32);
    const challengeBase64 = challenge.toString('base64url');

    let authenticationOptions;
    let staffInfo = null;

    if (staffId) {
      // 특정 직원 인증 모드 (기존 방식)
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

      authenticationOptions = {
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

      staffInfo = {
        id: staff.id,
        name: staff.name,
      };
    } else {
      // 직원 자동 식별 모드 (태블릿용)
      // 생체인증이 활성화된 모든 직원의 credential 목록 가져오기
      const staffList = await prisma.staff.findMany({
        where: {
          biometricEnabled: true,
          biometricCredentialId: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          biometricCredentialId: true,
        },
      });

      if (staffList.length === 0) {
        return NextResponse.json(
          { error: '생체인증이 등록된 직원이 없습니다.' },
          { status: 400 }
        );
      }

      authenticationOptions = {
        challenge: challengeBase64,
        timeout: 60000,
        rpId: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
        allowCredentials: staffList.map(staff => ({
          type: 'public-key' as const,
          id: staff.biometricCredentialId!,
        })),
        userVerification: 'required' as const,
      };
    }

    return NextResponse.json({
      success: true,
      options: authenticationOptions,
      staffInfo,
    });
  } catch (error) {
    console.error('❌ [출퇴근] Challenge 생성 실패:', error);
    return NextResponse.json(
      { error: 'Challenge 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
