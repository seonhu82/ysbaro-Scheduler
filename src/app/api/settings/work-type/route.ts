/**
 * 근무 형태 설정 API
 * GET: 현재 설정 조회
 * PATCH: 설정 수정
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: 구현 예정
  return NextResponse.json({
    success: true,
    data: {
      defaultWorkType: 'WEEK_4',
      week4WorkDays: 4,
      week4OffDays: 2,
      week5WorkDays: 5,
      week5OffDays: 1,
    },
  });
}

export async function PATCH() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: 구현 예정
  return NextResponse.json({ success: true });
}
