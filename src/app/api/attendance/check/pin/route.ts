import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// PIN 번호로 출퇴근 체크
export async function POST(request: NextRequest) {
  try {
    const { staffId, pinCode, checkType } = await request.json();

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
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!staff.pinCode) {
      return NextResponse.json(
        { error: 'PIN이 등록되지 않았습니다.' },
        { status: 400 }
      );
    }

    // PIN 검증
    const isValidPin = await bcrypt.compare(pinCode, staff.pinCode);
    if (!isValidPin) {
      console.warn(`⚠️ [출퇴근] 잘못된 PIN 시도: ${staff.name}`);
      return NextResponse.json(
        { error: 'PIN 번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 오늘 날짜
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 오늘 이미 같은 타입의 기록이 있는지 확인
    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        staffId: staff.id,
        checkType,
        checkTime: {
          gte: today,
        },
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

    // 직원의 clinicId 가져오기
    const staffWithClinic = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { clinicId: true },
    });

    if (!staffWithClinic?.clinicId) {
      return NextResponse.json(
        { error: '병원 정보를 찾을 수 없습니다.' },
        { status: 500 }
      );
    }

    const now = new Date();
    const dateOnly = new Date(now);
    dateOnly.setHours(0, 0, 0, 0);

    // 출퇴근 기록 생성
    const attendanceRecord = await prisma.attendanceRecord.create({
      data: {
        clinicId: staffWithClinic.clinicId,
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

    console.log(`✅ [출퇴근] ${checkType === 'IN' ? '출근' : '퇴근'}: ${staff.name} (PIN)`);

    return NextResponse.json({
      success: true,
      message: `${staff.name}님 ${checkType === 'IN' ? '출근' : '퇴근'} 처리되었습니다.`,
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
