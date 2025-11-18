import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 사유서가 제출된 출퇴근 기록 조회
 * GET /api/attendance/reasons?date=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // 날짜 계산 (KST 기준)
    let targetDate: Date;
    if (dateParam) {
      const [year, month, day] = dateParam.split('-').map(Number);
      targetDate = new Date(Date.UTC(year, month - 1, day));
    } else {
      const now = new Date();
      const kstOffset = 9 * 60; // KST는 UTC+9
      const kstNow = new Date(now.getTime() + kstOffset * 60 * 1000);
      targetDate = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()));
    }

    // 사유서가 있는 출퇴근 기록 조회 (notes 필드가 null이 아닌 것)
    const records = await prisma.attendanceRecord.findMany({
      where: {
        date: targetDate,
        notes: {
          not: null,
        },
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            departmentName: true,
          },
        },
      },
      orderBy: {
        checkTime: 'desc',
      },
    });

    // 지각/조퇴 판단 및 데이터 변환
    const reasonRecords = records.map(record => {
      const checkTime = new Date(record.checkTime);
      const checkHour = checkTime.getHours();
      const checkMinute = checkTime.getMinutes();

      let isLate = false;
      let lateMinutes = 0;
      let isEarlyLeave = false;
      let earlyMinutes = 0;

      if (record.checkType === 'IN') {
        // 출근: 09:00 이후면 지각
        if (checkHour > 9 || (checkHour === 9 && checkMinute > 0)) {
          isLate = true;
          lateMinutes = (checkHour - 9) * 60 + checkMinute;
        }
      } else if (record.checkType === 'OUT') {
        // 퇴근: 18:00 이전이면 조퇴
        if (checkHour < 18 || (checkHour === 18 && checkMinute < 0)) {
          isEarlyLeave = true;
          earlyMinutes = (18 - checkHour) * 60 + (0 - checkMinute);
        }
      }

      return {
        id: record.id,
        staffId: record.staffId,
        staffName: record.staff.name,
        departmentName: record.staff.departmentName,
        checkType: record.checkType,
        checkTime: record.checkTime.toISOString(),
        isLate,
        lateMinutes,
        isEarlyLeave,
        earlyMinutes,
        notes: record.notes || '',
      };
    });

    return NextResponse.json({
      success: true,
      data: reasonRecords,
    });
  } catch (error) {
    console.error('❌ [사유서 조회] 실패:', error);
    return NextResponse.json(
      { error: '사유서 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
