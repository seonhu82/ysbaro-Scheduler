/**
 * 출퇴근 기록 조회 API
 * GET: 출퇴근 이력 조회
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: 구현 예정
  // - 날짜 범위 필터링
  // - 직원 필터링
  // - 페이지네이션

  return NextResponse.json({
    success: true,
    data: [],
  });
}
