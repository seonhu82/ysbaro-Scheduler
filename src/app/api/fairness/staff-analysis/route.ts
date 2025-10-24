/**
 * 직원별 종합 형평성 분석 API (개선 버전)
 *
 * GET /api/fairness/staff-analysis?staffId=xxx&year=2025&month=6&clinicId=xxx
 *
 * 반환: 월별 현황 + 연간 누적 현황
 */

import { NextRequest, NextResponse } from 'next/server';
import { fairnessValidationService } from '@/lib/services/fairness-validation-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');
    const clinicId = searchParams.get('clinicId');

    // 필수 파라미터 검증
    if (!staffId || !yearStr || !monthStr || !clinicId) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'staffId, year, month, and clinicId are required',
        },
        { status: 400 }
      );
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    // 파라미터 유효성 검증
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          message: 'Year must be a valid number and month must be between 1 and 12',
        },
        { status: 400 }
      );
    }

    // 종합 분석 조회 (야간 + 주말)
    const status = await fairnessValidationService.getStaffShiftStatus(
      clinicId,
      staffId,
      year,
      month
    );

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting staff analysis:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
