/**
 * 출퇴근 통계 API
 * GET: 출퇴근 통계 조회
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: 구현 예정
  // - 월별 통계
  // - 지각/조퇴 통계
  // - 직원별 통계

  return NextResponse.json({
    success: true,
    data: {
      totalChecks: 0,
      lateCount: 0,
      earlyLeaveCount: 0,
      byStaff: [],
    },
  });
}
