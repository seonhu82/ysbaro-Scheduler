/**
 * QR 토큰 관리 API
 * GET: 현재 활성 토큰 조회
 * POST: 새 토큰 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateQRToken, getCurrentActiveToken, cleanupExpiredTokens } from '@/lib/services/qr-token-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenParam = searchParams.get('token');

    // 토큰 파라미터가 있으면 공개 검증 (로그인 불필요)
    if (tokenParam) {
      console.log('🔍 공개 토큰 검증:', tokenParam);

      const { validateQRToken } = await import('@/lib/services/qr-token-service');
      const validation = await validateQRToken(tokenParam);

      if (validation.valid && validation.tokenData) {
        return NextResponse.json({
          success: true,
          data: {
            token: tokenParam,
            checkType: validation.tokenData.checkType || 'IN',
            clinicId: validation.tokenData.clinicId,
            expiresAt: validation.tokenData.expiresAt,
            valid: true
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          error: validation.message || '유효하지 않은 토큰입니다'
        });
      }
    }

    // 토큰 파라미터가 없으면 인증된 사용자용 조회
    const session = await auth();

    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const clinicId = session.user.clinicId;

    // 만료된 토큰 정리
    await cleanupExpiredTokens(clinicId);

    // 현재 활성 토큰 조회
    const activeToken = await getCurrentActiveToken(clinicId);

    if (!activeToken) {
      // 활성 토큰이 없으면 새로 생성
      const newToken = await generateQRToken(clinicId);
      return NextResponse.json({
        success: true,
        data: newToken
      });
    }

    return NextResponse.json({
      success: true,
      data: activeToken
    });

  } catch (error) {
    console.error('QR token GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get QR token' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    let clinicId: string;

    // 인증된 사용자면 세션에서, 아니면 DB에서 첫 번째 클리닉 사용
    if (session?.user?.clinicId) {
      clinicId = session.user.clinicId;
    } else {
      // 공개 접근 (태블릿용): 첫 번째 활성 클리닉 사용
      const { prisma } = await import('@/lib/prisma');
      const clinic = await prisma.clinic.findFirst({
        select: { id: true }
      });

      if (!clinic) {
        return NextResponse.json(
          { success: false, error: 'No clinic found' },
          { status: 404 }
        );
      }

      clinicId = clinic.id;
    }

    // 요청 body에서 checkType 추출
    const body = await request.json();
    const checkType = (body?.checkType || 'IN') as 'IN' | 'OUT';

    // 새 QR 토큰 생성
    const newToken = await generateQRToken(clinicId, checkType);

    return NextResponse.json({
      success: true,
      data: newToken
    });

  } catch (error) {
    console.error('QR token POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate QR token' },
      { status: 500 }
    );
  }
}
