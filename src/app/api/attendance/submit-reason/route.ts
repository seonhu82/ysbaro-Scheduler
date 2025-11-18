import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 지각/조퇴 사유 제출
export async function POST(request: NextRequest) {
  try {
    const { recordId, reason } = await request.json();

    if (!recordId || !reason) {
      return NextResponse.json(
        { error: '기록 ID와 사유가 필요합니다.' },
        { status: 400 }
      );
    }

    // 출퇴근 기록 업데이트
    const updatedRecord = await prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        notes: reason,
      },
    });

    console.log(`📝 [사유 제출] 기록 ID: ${recordId}, 사유: ${reason}`);

    return NextResponse.json({
      success: true,
      message: '사유가 제출되었습니다.',
      record: updatedRecord,
    });
  } catch (error) {
    console.error('❌ [사유 제출] 실패:', error);
    return NextResponse.json(
      { error: '사유 제출에 실패했습니다.' },
      { status: 500 }
    );
  }
}
