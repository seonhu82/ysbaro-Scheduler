/**
 * 종합 형평성 분석 서비스
 *
 * 목적: 연별 누적 목표 + 월별 형평성 점수를 종합하여 분석
 * - 오프 신청 가능 여부 판단 (연별 + 월별 기준)
 * - 직원별 우선순위 계산
 * - 관리자용 대시보드 데이터 제공
 */

import { yearlyFairnessService, type FairnessAnalysisResult } from './yearly-fairness-service';
import {
  monthlyFairnessService,
  type MonthlyFairnessAnalysis,
  type FairnessScoreData,
} from './monthly-fairness-service';

export type DateType = 'NORMAL_WEEKDAY' | 'NIGHT_WEEKDAY' | 'WEEKEND' | 'HOLIDAY' | 'SUNDAY';

export interface ValidationResult {
  allowed: boolean;
  requiresFairnessCheck: boolean;
  reason?: string;
  message?: string;
  details?: {
    yearly?: {
      cumulativeTarget: number;
      currentCount: number;
      diff: number;
      status: string;
    };
    monthly?: {
      myScore: number;
      averageScore: number;
      minRequired: number;
      nightShiftCount: number;
      weekendCount: number;
      holidayCount: number;
    };
  };
}

export interface ComprehensiveAnalysis {
  staffId: string;
  staffName: string;
  year: number;
  month: number;

  // 연별 분석
  yearlyAnalysis: {
    nightShift: {
      cumulativeTarget: number;
      currentCount: number;
      diff: number;
      status: string;
      priority: number;
    };
    weekend: {
      cumulativeTarget: number;
      currentCount: number;
      diff: number;
      status: string;
      priority: number;
    };
  };

  // 월별 분석
  monthlyAnalysis: {
    nightShiftCount: number;
    weekendCount: number;
    holidayCount: number;
    totalScore: number;
    averageScore: number;
    status: string;
  };

  // 종합 판단
  overallStatus: 'high_priority' | 'normal' | 'low_priority';
  canApplyNightOff: boolean;
  canApplyWeekendOff: boolean;
}

export class ComprehensiveFairnessService {
  /**
   * 날짜 유형 판단
   *
   * @param date 날짜
   * @param hasNightShift 야간 진료 여부
   * @param isHoliday 공휴일 여부
   * @returns 날짜 유형
   */
  getDateType(date: Date, hasNightShift: boolean, isHoliday: boolean): DateType {
    const dayOfWeek = date.getDay();

    // 일요일
    if (dayOfWeek === 0) {
      return 'SUNDAY';
    }

    // 공휴일
    if (isHoliday) {
      return 'HOLIDAY';
    }

    // 토요일
    if (dayOfWeek === 6) {
      return 'WEEKEND';
    }

    // 평일 (야간 여부 확인)
    if (hasNightShift) {
      return 'NIGHT_WEEKDAY';
    }

    return 'NORMAL_WEEKDAY';
  }

  /**
   * 오프 신청 가능 여부 검증 (종합)
   *
   * @param clinicId 병원 ID
   * @param staffId 직원 ID
   * @param date 신청 날짜
   * @param hasNightShift 야간 진료 여부
   * @param isHoliday 공휴일 여부
   * @returns 검증 결과
   */
  async validateOffApplication(
    clinicId: string,
    staffId: string,
    date: Date,
    hasNightShift: boolean,
    isHoliday: boolean
  ): Promise<ValidationResult> {
    // 1. 날짜 유형 판단
    const dateType = this.getDateType(date, hasNightShift, isHoliday);

    // 일반 평일이나 일요일은 형평성 체크 불필요
    if (dateType === 'NORMAL_WEEKDAY' || dateType === 'SUNDAY') {
      return {
        allowed: true,
        requiresFairnessCheck: false,
      };
    }

    // 2. 형평성 설정 확인
    const settings = await monthlyFairnessService.getFairnessSettings(clinicId);
    if (!settings.enableFairnessCheck) {
      return {
        allowed: true,
        requiresFairnessCheck: false,
      };
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // 3. 연별 분석 (누적 목표 기반)
    const yearlyReport = await yearlyFairnessService.getComprehensiveFairnessReport(year, month);

    let yearlyStatus: 'behind' | 'on_track' | 'ahead' = 'on_track';
    let yearlyCumulativeTarget = 0;
    let yearlyCurrentCount = 0;
    let yearlyDiff = 0;

    if (dateType === 'NIGHT_WEEKDAY') {
      const nightData = yearlyReport.nightShift.employees[staffId];
      if (nightData) {
        yearlyStatus = nightData.status;
        yearlyCumulativeTarget = nightData.target;
        yearlyCurrentCount = nightData.currentCount;
        yearlyDiff = nightData.diff;
      }
    } else if (dateType === 'WEEKEND') {
      const weekendData = yearlyReport.weekendWork.employees[staffId];
      if (weekendData) {
        yearlyStatus = weekendData.status;
        yearlyCumulativeTarget = weekendData.target;
        yearlyCurrentCount = weekendData.currentCount;
        yearlyDiff = weekendData.diff;
      }
    }

    // 4. 월별 분석
    const monthlyResult = await monthlyFairnessService.canApplyOff(
      clinicId,
      staffId,
      year,
      month,
      dateType === 'NIGHT_WEEKDAY' ? 'night' : 'weekend'
    );

    // 5. 종합 판단
    // 연별로 2회 이상 부족하면 제한
    if (yearlyStatus === 'behind') {
      return {
        allowed: false,
        requiresFairnessCheck: true,
        reason: 'YEARLY_FAIRNESS_LOW',
        message: `올해 ${dateType === 'NIGHT_WEEKDAY' ? '야간' : '주말'} 근무가 누적 목표보다 부족하여 해당 날짜 오프를 신청할 수 없습니다.`,
        details: {
          yearly: {
            cumulativeTarget: yearlyCumulativeTarget,
            currentCount: yearlyCurrentCount,
            diff: yearlyDiff,
            status: yearlyStatus,
          },
          monthly: monthlyResult.details,
        },
      };
    }

    // 월별로도 평균 이하면 제한
    if (!monthlyResult.allowed) {
      return {
        allowed: false,
        requiresFairnessCheck: true,
        reason: 'MONTHLY_FAIRNESS_LOW',
        message: monthlyResult.reason,
        details: {
          yearly: {
            cumulativeTarget: yearlyCumulativeTarget,
            currentCount: yearlyCurrentCount,
            diff: yearlyDiff,
            status: yearlyStatus,
          },
          monthly: monthlyResult.details,
        },
      };
    }

    // 신청 가능
    return {
      allowed: true,
      requiresFairnessCheck: true,
      message: '신청 가능합니다.',
      details: {
        yearly: {
          cumulativeTarget: yearlyCumulativeTarget,
          currentCount: yearlyCurrentCount,
          diff: yearlyDiff,
          status: yearlyStatus,
        },
        monthly: monthlyResult.details,
      },
    };
  }

  /**
   * 직원별 종합 형평성 분석
   *
   * @param clinicId 병원 ID
   * @param staffId 직원 ID
   * @param year 연도
   * @param month 월
   * @returns 종합 분석 결과
   */
  async getStaffComprehensiveAnalysis(
    clinicId: string,
    staffId: string,
    year: number,
    month: number
  ): Promise<ComprehensiveAnalysis | null> {
    // 1. 연별 분석
    const yearlyReport = await yearlyFairnessService.getComprehensiveFairnessReport(year, month);

    const nightShiftYearly = yearlyReport.nightShift.employees[staffId];
    const weekendYearly = yearlyReport.weekendWork.employees[staffId];

    if (!nightShiftYearly || !weekendYearly) {
      return null;
    }

    // 2. 월별 분석
    const monthlyScore = await monthlyFairnessService.getStaffMonthlyScore(
      clinicId,
      staffId,
      year,
      month
    );

    if (!monthlyScore) {
      return null;
    }

    const monthlyAnalysis = await monthlyFairnessService.getMonthlyFairnessAnalysis(
      clinicId,
      year,
      month
    );

    // 3. 종합 판단
    let overallStatus: 'high_priority' | 'normal' | 'low_priority' = 'normal';

    // 연별로 behind면 우선순위 높음
    if (nightShiftYearly.status === 'behind' || weekendYearly.status === 'behind') {
      overallStatus = 'high_priority';
    }
    // 연별로 ahead면 우선순위 낮음
    else if (nightShiftYearly.status === 'ahead' && weekendYearly.status === 'ahead') {
      overallStatus = 'low_priority';
    }

    // 월별 상태도 고려
    if (monthlyScore.status === 'low') {
      overallStatus = 'high_priority';
    } else if (monthlyScore.status === 'high') {
      overallStatus = 'low_priority';
    }

    return {
      staffId,
      staffName: monthlyScore.staffName,
      year,
      month,
      yearlyAnalysis: {
        nightShift: {
          cumulativeTarget: nightShiftYearly.target,
          currentCount: nightShiftYearly.currentCount,
          diff: nightShiftYearly.diff,
          status: nightShiftYearly.status,
          priority: nightShiftYearly.priority,
        },
        weekend: {
          cumulativeTarget: weekendYearly.target,
          currentCount: weekendYearly.currentCount,
          diff: weekendYearly.diff,
          status: weekendYearly.status,
          priority: weekendYearly.priority,
        },
      },
      monthlyAnalysis: {
        nightShiftCount: monthlyScore.nightShiftCount,
        weekendCount: monthlyScore.weekendCount,
        holidayCount: monthlyScore.holidayCount,
        totalScore: monthlyScore.totalScore,
        averageScore: monthlyAnalysis.averageScore,
        status: monthlyScore.status,
      },
      overallStatus,
      canApplyNightOff: monthlyScore.canApplyNightOff && nightShiftYearly.status !== 'behind',
      canApplyWeekendOff: monthlyScore.canApplyWeekendOff && weekendYearly.status !== 'behind',
    };
  }

  /**
   * 전체 직원 종합 형평성 분석
   *
   * @param clinicId 병원 ID
   * @param year 연도
   * @param month 월
   * @returns 전체 직원 분석 결과
   */
  async getAllStaffComprehensiveAnalysis(
    clinicId: string,
    year: number,
    month: number
  ): Promise<ComprehensiveAnalysis[]> {
    const monthlyAnalysis = await monthlyFairnessService.getMonthlyFairnessAnalysis(
      clinicId,
      year,
      month
    );

    const results: ComprehensiveAnalysis[] = [];

    for (const score of monthlyAnalysis.scores) {
      const analysis = await this.getStaffComprehensiveAnalysis(
        clinicId,
        score.staffId,
        year,
        month
      );

      if (analysis) {
        results.push(analysis);
      }
    }

    return results;
  }
}

// 싱글톤 인스턴스 export
export const comprehensiveFairnessService = new ComprehensiveFairnessService();
