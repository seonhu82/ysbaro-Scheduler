import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// WebAuthn 등록을 위한 Challenge 생성
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
      select: {
        id: true,
        name: true,
        biometricEnabled: true,
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 랜덤 Challenge 생성 (32 bytes)
    const challenge = crypto.randomBytes(32);
    const challengeBase64 = challenge.toString('base64url');

    // Challenge를 세션 또는 임시 스토리지에 저장 (여기서는 응답으로 반환)
    // 실제로는 Redis나 세션에 저장하고 5분 후 만료되도록 해야 함

    // WebAuthn 등록 옵션 생성
    const registrationOptions = {
      challenge: challengeBase64,
      rp: {
        name: '윤성바로치과 스케줄러',
        id: process.env.NEXT_PUBLIC_RP_ID || 'localhost', // 도메인 (예: ysbaro.com)
      },
      user: {
        id: staff.id,
        name: staff.id,
        displayName: staff.name,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      timeout: 60000, // 60초
      attestation: 'none' as const,
      authenticatorSelection: {
        authenticatorAttachment: 'platform' as const, // 기기 내장 생체인증
        requireResidentKey: false,
        userVerification: 'required' as const,
      },
    };

    return NextResponse.json({
      success: true,
      options: registrationOptions,
      staffInfo: {
        id: staff.id,
        name: staff.name,
        alreadyRegistered: staff.biometricEnabled,
      },
    });
  } catch (error) {
    console.error('❌ [생체인증] Challenge 생성 실패:', error);
    return NextResponse.json(
      { error: 'Challenge 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
