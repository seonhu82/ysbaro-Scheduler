/**
 * 전체 직원 종합 형평성 분석 API (관리자용)
 *
 * GET /api/fairness/all-staff-analysis?year=2025&month=6&clinicId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { comprehensiveFairnessService } from '@/lib/services/comprehensive-fairness-service';
import { yearlyFairnessService } from '@/lib/services/yearly-fairness-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');
    const clinicId = searchParams.get('clinicId');

    // 필수 파라미터 검증
    if (!yearStr || !monthStr || !clinicId) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'year, month, and clinicId are required',
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

    // 전체 직원 분석
    const allAnalysis = await comprehensiveFairnessService.getAllStaffComprehensiveAnalysis(
      clinicId,
      year,
      month
    );

    // 종합 리포트 (권장 사항 포함)
    const comprehensiveReport = await yearlyFairnessService.getComprehensiveFairnessReport(
      year,
      month
    );

    return NextResponse.json({
      success: true,
      data: {
        staffAnalysis: allAnalysis,
        recommendations: comprehensiveReport.recommendations,
        summary: {
          totalStaff: allAnalysis.length,
          highPriority: allAnalysis.filter((a) => a.overallStatus === 'high_priority').length,
          normal: allAnalysis.filter((a) => a.overallStatus === 'normal').length,
          lowPriority: allAnalysis.filter((a) => a.overallStatus === 'low_priority').length,
        },
      },
    });
  } catch (error) {
    console.error('Error getting all staff analysis:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
