/**
 * QR 토큰 관리 API
 * GET: 현재 활성 토큰 조회
 * POST: 새 토큰 생성
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: 구현 예정
  // - 현재 활성화된 QR 토큰 조회
  // - 만료 시간 확인
  return NextResponse.json({
    success: true,
    data: {
      token: 'placeholder_token',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      isActive: true,
    },
  });
}

export async function POST() {
  // TODO: 구현 예정
  // - 새 QR 토큰 생성
  // - 이전 토큰 비활성화
  // - 5분 만료 시간 설정
  return NextResponse.json({ success: true });
}
