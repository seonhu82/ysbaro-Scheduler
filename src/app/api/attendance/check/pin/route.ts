import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// PIN 번호로 출퇴근 체크
export async function POST(request: NextRequest) {
  try {
    const { staffId, pinCode, checkType, qrToken } = await request.json();

    if (!staffId || !pinCode || !checkType) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (checkType !== 'IN' && checkType !== 'OUT') {
      return NextResponse.json(
        { error: '올바른 체크 타입이 아닙니다.' },
        { status: 400 }
      );
    }

    // 직원 확인 및 PIN 확인
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        departmentName: true,
        pinCode: true,
        birthDateStr: true,
        clinicId: true,
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // PIN 검증
    let isValidPin = false;

    if (staff.pinCode) {
      // PIN이 등록되어 있는 경우
      // bcrypt 해시는 "$2a$", "$2b$", "$2y$" 등으로 시작
      const isBcryptHash = staff.pinCode.startsWith('$2a$') ||
                          staff.pinCode.startsWith('$2b$') ||
                          staff.pinCode.startsWith('$2y$');

      if (isBcryptHash) {
        // bcrypt 해시면 bcrypt.compare로 비교
        isValidPin = await bcrypt.compare(pinCode, staff.pinCode);
      } else {
        // 평문이면 직접 비교 (레거시 데이터 지원)
        isValidPin = pinCode === staff.pinCode;
      }
    } else if (staff.birthDateStr) {
      // PIN이 없으면 생년월일(6자리)로 비교
      // birthDateStr 형식: YYMMDD 또는 YYYYMMDD -> 뒤 6자리 사용
      const birthPin = staff.birthDateStr.slice(-6);
      isValidPin = pinCode === birthPin;
    } else {
      return NextResponse.json(
        { error: 'PIN 또는 생년월일이 등록되지 않았습니다.' },
        { status: 400 }
      );
    }

    if (!isValidPin) {
      console.warn(`⚠️ [출퇴근] 잘못된 PIN 시도: ${staff.name}`);
      return NextResponse.json(
        { error: 'PIN 번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 오늘 날짜 (KST 기준)
    const now2 = new Date();
    const kstOffset2 = 9 * 60; // KST는 UTC+9
    const kstNow2 = new Date(now2.getTime() + kstOffset2 * 60 * 1000);
    const today = new Date(Date.UTC(kstNow2.getUTCFullYear(), kstNow2.getUTCMonth(), kstNow2.getUTCDate()));

    // 오늘 이미 같은 타입의 기록이 있는지 확인
    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        staffId: staff.id,
        checkType,
        date: today,
      },
      orderBy: {
        checkTime: 'desc',
      },
    });

    if (existingRecord) {
      const lastCheckTime = existingRecord.checkTime;
      const timeDiff = Date.now() - lastCheckTime.getTime();
      const minutesDiff = Math.floor(timeDiff / 1000 / 60);

      // 5분 이내 중복 체크 방지
      if (minutesDiff < 5) {
        return NextResponse.json(
          {
            error: `이미 ${checkType === 'IN' ? '출근' : '퇴근'} 처리되었습니다. (${minutesDiff}분 전)`,
          },
          { status: 400 }
        );
      }
    }

    // clinicId는 이미 staff에 있음
    if (!staff.clinicId) {
      return NextResponse.json(
        { error: '병원 정보를 찾을 수 없습니다.' },
        { status: 500 }
      );
    }

    const now = new Date();

    // KST(한국 시간) 기준으로 오늘 날짜 계산
    const kstOffset = 9 * 60; // KST는 UTC+9
    const kstNow = new Date(now.getTime() + kstOffset * 60 * 1000);
    const dateOnly = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()));

    // 오늘 스케줄에 있는지 확인
    const staffAssignment = await prisma.staffAssignment.findFirst({
      where: {
        staffId: staff.id,
        date: dateOnly,
        shiftType: {
          not: 'OFF',
        },
      },
      include: {
        schedule: {
          select: {
            status: true,
          },
        },
      },
    });

    const isScheduled = staffAssignment !== null && staffAssignment.schedule.status === 'DEPLOYED';

    // 지각/조퇴 판단 (KST 기준)
    const checkHour = kstNow.getUTCHours();
    const checkMinute = kstNow.getUTCMinutes();

    let isLate = false;
    let isEarlyLeave = false;
    let lateMinutes = 0;
    let earlyMinutes = 0;

    if (checkType === 'IN') {
      // 출근: 09:00 이후면 지각
      const standardHour = 9;
      const standardMinute = 0;
      if (checkHour > standardHour || (checkHour === standardHour && checkMinute > standardMinute)) {
        isLate = true;
        lateMinutes = (checkHour - standardHour) * 60 + (checkMinute - standardMinute);
      }
    } else if (checkType === 'OUT') {
      // 퇴근: 18:00 이전이면 조퇴
      const standardHour = 18;
      const standardMinute = 0;
      if (checkHour < standardHour || (checkHour === standardHour && checkMinute < standardMinute)) {
        isEarlyLeave = true;
        earlyMinutes = (standardHour - checkHour) * 60 + (standardMinute - checkMinute);
      }
    }

    // 출퇴근 기록 생성
    const attendanceRecord = await prisma.attendanceRecord.create({
      data: {
        clinicId: staff.clinicId,
        staffId: staff.id,
        checkType,
        checkMethod: 'PIN',
        checkTime: now,
        date: dateOnly,
        deviceFingerprint: request.headers.get('user-agent') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      },
    });

    console.log(`✅ [출퇴근] ${checkType === 'IN' ? '출근' : '퇴근'}: ${staff.name} (PIN)${isLate ? ` - 지각 ${lateMinutes}분` : ''}${isEarlyLeave ? ` - 조퇴 ${earlyMinutes}분` : ''}${!isScheduled ? ' - 스케줄 외 출근' : ''}`);

    // QR 토큰이 있으면 사용 처리
    if (qrToken) {
      try {
        const { markTokenAsUsed } = await import('@/lib/services/qr-token-service');
        await markTokenAsUsed(qrToken, staff.id);
        console.log(`🔒 [QR토큰] 토큰 사용 처리됨: ${qrToken.substring(0, 8)}...`);
      } catch (error) {
        console.error('QR 토큰 사용 처리 실패:', error);
        // 토큰 처리 실패는 출퇴근 기록에는 영향 없음
      }
    }

    return NextResponse.json({
      success: true,
      message: `${staff.name}님 ${checkType === 'IN' ? '출근' : '퇴근'} 처리되었습니다.`,
      isScheduled,
      isLate,
      lateMinutes,
      isEarlyLeave,
      earlyMinutes,
      record: {
        id: attendanceRecord.id,
        staffName: staff.name,
        department: staff.departmentName,
        checkType,
        checkTime: attendanceRecord.checkTime,
        checkMethod: 'PIN',
      },
    });
  } catch (error) {
    console.error('❌ [출퇴근] PIN 인증 실패:', error);
    return NextResponse.json(
      { error: '출퇴근 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
