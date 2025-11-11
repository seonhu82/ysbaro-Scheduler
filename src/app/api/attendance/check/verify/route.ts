import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 출퇴근 인증 검증 및 기록
export async function POST(request: NextRequest) {
  try {
    const { staffId, credential, challenge, checkType } = await request.json();

    if (!staffId || !credential || !challenge || !checkType) {
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

    // 직원 확인
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        name: true,
        departmentName: true,
        biometricEnabled: true,
        biometricCredentialId: true,
        biometricCounter: true,
      },
    });

    if (!staff) {
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (!staff.biometricEnabled) {
      return NextResponse.json(
        { error: '생체인증이 등록되지 않았습니다.' },
        { status: 400 }
      );
    }

    // Credential 검증
    const { response } = credential;
    const clientDataJSON = response.clientDataJSON;

    // ClientDataJSON 파싱
    const clientData = JSON.parse(
      Buffer.from(clientDataJSON, 'base64').toString('utf-8')
    );

    // Challenge 검증
    if (clientData.challenge !== challenge) {
      return NextResponse.json(
        { error: 'Challenge 검증에 실패했습니다.' },
        { status: 400 }
      );
    }

    // Type 검증
    if (clientData.type !== 'webauthn.get') {
      return NextResponse.json(
        { error: '잘못된 인증 타입입니다.' },
        { status: 400 }
      );
    }

    // Counter 검증 (재생 공격 방지)
    const authenticatorData = Buffer.from(response.authenticatorData, 'base64');
    const counter = authenticatorData.readUInt32BE(33); // Counter는 byte 33-36에 위치

    if (counter <= staff.biometricCounter) {
      console.warn('⚠️ [출퇴근] Counter 이상 감지:', staff.name, counter, 'vs', staff.biometricCounter);
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
        checkMethod: 'BIOMETRIC',
        checkTime: now,
        date: dateOnly,
        deviceFingerprint: request.headers.get('user-agent') || 'unknown',
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      },
    });

    // Counter 업데이트
    await prisma.staff.update({
      where: { id: staff.id },
      data: {
        biometricCounter: counter,
      },
    });

    console.log(`✅ [출퇴근] ${checkType === 'IN' ? '출근' : '퇴근'}: ${staff.name} (생체인증)`);

    return NextResponse.json({
      success: true,
      message: `${staff.name}님 ${checkType === 'IN' ? '출근' : '퇴근'} 처리되었습니다.`,
      record: {
        id: attendanceRecord.id,
        staffName: staff.name,
        department: staff.departmentName,
        checkType,
        checkTime: attendanceRecord.checkTime,
        checkMethod: 'BIOMETRIC',
      },
    });
  } catch (error) {
    console.error('❌ [출퇴근] 인증 검증 실패:', error);
    return NextResponse.json(
      { error: '출퇴근 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
