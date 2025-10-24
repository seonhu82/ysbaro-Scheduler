/**
 * 형평성 기반 오프 신청 가능 여부 확인 API (개선 버전)
 *
 * GET /api/fairness/check-eligibility?staffId=xxx&date=2025-11-15&clinicId=xxx
 *
 * 이중 검증:
 * 1. 월별 최소 요구: 해당 월에 반드시 근무해야 하는 최소 횟수
 * 2. 연간 형평성: 1월부터 현재까지 누적 근무가 평균 이상인지 확인
 */

import { NextRequest, NextResponse } from 'next/server';
import { fairnessValidationService } from '@/lib/services/fairness-validation-service';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const dateStr = searchParams.get('date');
    const clinicId = searchParams.get('clinicId');

    // 필수 파라미터 검증
    if (!staffId || !dateStr || !clinicId) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'staffId, date, and clinicId are required',
        },
        { status: 400 }
      );
    }

    const date = new Date(dateStr);

    // 날짜 유효성 검증
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        {
          error: 'Invalid date format',
          message: 'Date must be in ISO format (YYYY-MM-DD)',
        },
        { status: 400 }
      );
    }

    // 직원 존재 여부 확인
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return NextResponse.json(
        {
          error: 'Staff not found',
          message: 'Invalid staff ID',
        },
        { status: 404 }
      );
    }

    // 해당 날짜의 스케줄 정보 조회 (야간 진료 여부)
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // DailySlot에서 해당 날짜 정보 조회
    const dailySlot = await prisma.dailySlot.findFirst({
      where: {
        date: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
        week: {
          clinicId,
        },
      },
      include: {
        week: true,
      },
    });

    // 야간 진료 여부 (임시로 월~금을 야간으로 가정)
    const dayOfWeek = date.getDay();
    const hasNightShift = dayOfWeek >= 1 && dayOfWeek <= 5;

    // 공휴일 여부 확인
    const holiday = await prisma.holiday.findFirst({
      where: {
        clinicId,
        date: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    const isHoliday = !!holiday;

    // 형평성 검증 (이중 체크)
    const validationResult = await fairnessValidationService.validateOffApplication(
      clinicId,
      staffId,
      date,
      hasNightShift,
      isHoliday
    );

    return NextResponse.json({
      success: true,
      ...validationResult,
    });
  } catch (error) {
    console.error('Error checking fairness eligibility:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
