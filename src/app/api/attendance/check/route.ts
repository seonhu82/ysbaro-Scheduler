/**
 * 출퇴근 체크 API
 * POST: 출근/퇴근 체크
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateQRToken, markTokenAsUsed } from '@/lib/services/qr-token-service';
import { processAttendanceCheck } from '@/lib/services/attendance-service';
import { CheckType } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId, pin, token, checkType, deviceInfo, location } = body;

    // 1. 필수 필드 검증
    if (!staffId || !pin || !token || !checkType) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다' },
        { status: 400 }
      );
    }

    // 2. QR 토큰 검증
    const tokenValidation = await validateQRToken(token);

    if (!tokenValidation.valid) {
      return NextResponse.json(
        { success: false, error: tokenValidation.message },
        { status: 400 }
      );
    }

    // 3. 출퇴근 체크 처리
    const result = await processAttendanceCheck({
      staffId,
      token,
      checkType: checkType as CheckType,
      deviceInfo: deviceInfo || {
        userAgent: request.headers.get('user-agent') || 'unknown',
        platform: request.headers.get('sec-ch-ua-platform') || undefined
      },
      location: location || {
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
      }
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    // 4. 토큰 사용 처리
    await markTokenAsUsed(token, staffId);

    return NextResponse.json({
      success: true,
      message: result.message,
      recordId: result.recordId
    });

  } catch (error) {
    console.error('Attendance check error:', error);
    return NextResponse.json(
      { success: false, error: '출퇴근 체크 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
