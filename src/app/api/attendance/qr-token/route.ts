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

    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const clinicId = session.user.clinicId;

    // 새 QR 토큰 생성
    const newToken = await generateQRToken(clinicId);

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
