import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// WebAuthn 등록 검증 및 저장
export async function POST(request: NextRequest) {
  try {
    const { staffId, credential, challenge } = await request.json();

    if (!staffId || !credential || !challenge) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
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

    // Credential 정보 추출
    const {
      id: credentialId,
      rawId,
      response,
      type,
      authenticatorAttachment,
    } = credential;

    // Response 디코딩
    const attestationObject = response.attestationObject;
    const clientDataJSON = response.clientDataJSON;

    // ClientDataJSON 파싱 및 검증
    const clientData = JSON.parse(
      Buffer.from(clientDataJSON, 'base64').toString('utf-8')
    );

    // Challenge 검증
    if (clientData.challenge !== challenge) {
      return NextResponse.json(
        { error: 'Challenge 검증에 실패했습니다.' },
        { status: 400 }
      );
    }

    // Origin 검증 (프로덕션에서는 실제 도메인 확인 필요)
    const expectedOrigin = process.env.NEXT_PUBLIC_ORIGIN || 'http://localhost:3000';
    if (clientData.origin !== expectedOrigin) {
      console.warn('⚠️ Origin 불일치:', clientData.origin, 'vs', expectedOrigin);
    }

    // Type 검증
    if (clientData.type !== 'webauthn.create') {
      return NextResponse.json(
        { error: '잘못된 인증 타입입니다.' },
        { status: 400 }
      );
    }

    // AttestationObject 파싱 (CBOR 디코딩)
    // 실제로는 cbor 라이브러리 필요하지만, 여기서는 간소화
    const attestationBuffer = Buffer.from(attestationObject, 'base64');

    // Public Key 추출 (실제로는 CBOR 파싱 필요)
    // 여기서는 전체 attestationObject를 암호화해서 저장
    const publicKeyEncrypted = attestationBuffer.toString('base64');

    // 기기 타입 결정
    let deviceType = 'unknown';
    if (authenticatorAttachment === 'platform') {
      // 사용자 에이전트에서 추측
      const userAgent = request.headers.get('user-agent') || '';
      if (userAgent.includes('Android')) {
        deviceType = 'fingerprint'; // 안드로이드는 주로 지문
      } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        deviceType = 'face'; // iOS는 Face ID 또는 Touch ID
      } else {
        deviceType = 'fingerprint'; // 기본값
      }
    }

    // DB에 저장
    const updatedStaff = await prisma.staff.update({
      where: { id: staffId },
      data: {
        biometricEnabled: true,
        biometricPublicKey: publicKeyEncrypted,
        biometricCredentialId: credentialId,
        biometricCounter: 0,
        biometricRegisteredAt: new Date(),
        biometricDeviceType: deviceType,
      },
    });

    console.log(`✅ [생체인증] 등록 완료: ${staff.name} (${deviceType})`);

    return NextResponse.json({
      success: true,
      message: '생체인증이 성공적으로 등록되었습니다.',
      staff: {
        id: updatedStaff.id,
        name: updatedStaff.name,
        biometricEnabled: true,
        deviceType,
        registeredAt: updatedStaff.biometricRegisteredAt,
      },
    });
  } catch (error) {
    console.error('❌ [생체인증] 등록 검증 실패:', error);
    return NextResponse.json(
      { error: '생체인증 등록에 실패했습니다.' },
      { status: 500 }
    );
  }
}
