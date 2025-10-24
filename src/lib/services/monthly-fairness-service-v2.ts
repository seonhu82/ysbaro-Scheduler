/**
 * 월별 형평성 점수 계산 서비스 v2
 *
 * 변경사항:
 * - 통합 점수(totalScore) 제거
 * - 각 형평성 구분(야간/주말/공휴일/공휴일전후)별로 독립적인 횟수 추적
 * - 각 구분별로 평균과 비교하여 개별 판단
 */

import { prisma } from '@/lib/prisma';

export interface FairnessScoreData {
  staffId: string;
  staffName: string;
  nightShiftCount: number;
  weekendCount: number;
  holidayCount: number;
  holidayAdjacentCount: number;
  nightShiftStatus: 'low' | 'normal' | 'high';
  weekendStatus: 'low' | 'normal' | 'high';
  holidayStatus: 'low' | 'normal' | 'high';
  holidayAdjacentStatus: 'low' | 'normal' | 'high';
  canApplyNightOff: boolean;
  canApplyWeekendOff: boolean;
  canApplyHolidayOff: boolean;
  canApplyHolidayAdjacentOff: boolean;
}

export interface MonthlyFairnessAnalysis {
  year: number;
  month: number;
  nightShift: {
    average: number;
    min: number;
    max: number;
  };
  weekend: {
    average: number;
    min: number;
    max: number;
  };
  holiday: {
    average: number;
    min: number;
    max: number;
  };
  holidayAdjacent: {
    average: number;
    min: number;
    max: number;
  };
  fairnessThreshold: number;
  scores: FairnessScoreData[];
}

export interface FairnessSettings {
  enableNightShiftFairness: boolean;
  enableWeekendFairness: boolean;
  enableHolidayFairness: boolean;
  enableHolidayAdjacentFairness: boolean;
  fairnessThreshold: number;
}

export class MonthlyFairnessServiceV2 {
  /**
   * 형평성 설정 조회
   */
  async getFairnessSettings(clinicId: string): Promise<FairnessSettings> {
    const settings = await prisma.fairnessSettings.findUnique({
      where: { clinicId },
    });

    if (!settings) {
      return {
        enableNightShiftFairness: true,
        enableWeekendFairness: true,
        enableHolidayFairness: true,
        enableHolidayAdjacentFairness: false,
        fairnessThreshold: 0.2,
      };
    }

    return {
      enableNightShiftFairness: settings.enableNightShiftFairness,
      enableWeekendFairness: settings.enableWeekendFairness,
      enableHolidayFairness: settings.enableHolidayFairness,
      enableHolidayAdjacentFairness: settings.enableHolidayAdjacentFairness,
      fairnessThreshold: settings.fairnessThreshold,
    };
  }

  /**
   * 월별 형평성 분석
   */
  async getMonthlyFairnessAnalysis(
    clinicId: string,
    year: number,
    month: number
  ): Promise<MonthlyFairnessAnalysis> {
    const settings = await this.getFairnessSettings(clinicId);

    // 활성 직원 조회
    const staffList = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
      },
      include: {
        fairnessScores: {
          where: { year, month },
        },
      },
    });

    // 각 구분별 합계 계산
    let totalNightShift = 0;
    let totalWeekend = 0;
    let totalHoliday = 0;
    let totalHolidayAdjacent = 0;

    const scores: FairnessScoreData[] = [];

    for (const staff of staffList) {
      const score = staff.fairnessScores[0];

      const nightShiftCount = score?.nightShiftCount ?? 0;
      const weekendCount = score?.weekendCount ?? 0;
      const holidayCount = score?.holidayCount ?? 0;
      const holidayAdjacentCount = score?.holidayAdjacentCount ?? 0;

      totalNightShift += nightShiftCount;
      totalWeekend += weekendCount;
      totalHoliday += holidayCount;
      totalHolidayAdjacent += holidayAdjacentCount;

      scores.push({
        staffId: staff.id,
        staffName: staff.name,
        nightShiftCount,
        weekendCount,
        holidayCount,
        holidayAdjacentCount,
        nightShiftStatus: 'normal',
        weekendStatus: 'normal',
        holidayStatus: 'normal',
        holidayAdjacentStatus: 'normal',
        canApplyNightOff: true,
        canApplyWeekendOff: true,
        canApplyHolidayOff: true,
        canApplyHolidayAdjacentOff: true,
      });
    }

    const staffCount = staffList.length;

    // 각 구분별 평균 계산
    const nightShiftAvg = staffCount > 0 ? totalNightShift / staffCount : 0;
    const weekendAvg = staffCount > 0 ? totalWeekend / staffCount : 0;
    const holidayAvg = staffCount > 0 ? totalHoliday / staffCount : 0;
    const holidayAdjacentAvg = staffCount > 0 ? totalHolidayAdjacent / staffCount : 0;

    // 최소/최대 허용 범위 계산
    const nightShiftMin = nightShiftAvg * (1 - settings.fairnessThreshold);
    const nightShiftMax = nightShiftAvg * (1 + settings.fairnessThreshold);
    const weekendMin = weekendAvg * (1 - settings.fairnessThreshold);
    const weekendMax = weekendAvg * (1 + settings.fairnessThreshold);
    const holidayMin = holidayAvg * (1 - settings.fairnessThreshold);
    const holidayMax = holidayAvg * (1 + settings.fairnessThreshold);
    const holidayAdjacentMin = holidayAdjacentAvg * (1 - settings.fairnessThreshold);
    const holidayAdjacentMax = holidayAdjacentAvg * (1 + settings.fairnessThreshold);

    // 각 직원의 상태 및 신청 가능 여부 업데이트
    for (const scoreData of scores) {
      // 야간
      if (settings.enableNightShiftFairness) {
        if (scoreData.nightShiftCount < nightShiftMin) {
          scoreData.nightShiftStatus = 'low';
          scoreData.canApplyNightOff = false;
        } else if (scoreData.nightShiftCount > nightShiftMax) {
          scoreData.nightShiftStatus = 'high';
        }
      }

      // 주말
      if (settings.enableWeekendFairness) {
        if (scoreData.weekendCount < weekendMin) {
          scoreData.weekendStatus = 'low';
          scoreData.canApplyWeekendOff = false;
        } else if (scoreData.weekendCount > weekendMax) {
          scoreData.weekendStatus = 'high';
        }
      }

      // 공휴일
      if (settings.enableHolidayFairness) {
        if (scoreData.holidayCount < holidayMin) {
          scoreData.holidayStatus = 'low';
          scoreData.canApplyHolidayOff = false;
        } else if (scoreData.holidayCount > holidayMax) {
          scoreData.holidayStatus = 'high';
        }
      }

      // 공휴일 전후
      if (settings.enableHolidayAdjacentFairness) {
        if (scoreData.holidayAdjacentCount < holidayAdjacentMin) {
          scoreData.holidayAdjacentStatus = 'low';
          scoreData.canApplyHolidayAdjacentOff = false;
        } else if (scoreData.holidayAdjacentCount > holidayAdjacentMax) {
          scoreData.holidayAdjacentStatus = 'high';
        }
      }
    }

    return {
      year,
      month,
      nightShift: {
        average: Math.round(nightShiftAvg * 100) / 100,
        min: Math.round(nightShiftMin * 100) / 100,
        max: Math.round(nightShiftMax * 100) / 100,
      },
      weekend: {
        average: Math.round(weekendAvg * 100) / 100,
        min: Math.round(weekendMin * 100) / 100,
        max: Math.round(weekendMax * 100) / 100,
      },
      holiday: {
        average: Math.round(holidayAvg * 100) / 100,
        min: Math.round(holidayMin * 100) / 100,
        max: Math.round(holidayMax * 100) / 100,
      },
      holidayAdjacent: {
        average: Math.round(holidayAdjacentAvg * 100) / 100,
        min: Math.round(holidayAdjacentMin * 100) / 100,
        max: Math.round(holidayAdjacentMax * 100) / 100,
      },
      fairnessThreshold: settings.fairnessThreshold,
      scores,
    };
  }

  /**
   * 특정 직원의 월별 점수 조회
   */
  async getStaffMonthlyScore(
    clinicId: string,
    staffId: string,
    year: number,
    month: number
  ): Promise<FairnessScoreData | null> {
    const analysis = await this.getMonthlyFairnessAnalysis(clinicId, year, month);
    return analysis.scores.find((s) => s.staffId === staffId) ?? null;
  }

  /**
   * 특정 형평성 타입의 오프 신청 가능 여부 판단
   */
  async canApplyOff(
    clinicId: string,
    staffId: string,
    year: number,
    month: number,
    fairnessType: 'night' | 'weekend' | 'holiday' | 'holidayAdjacent'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    details?: {
      myCount: number;
      average: number;
      minRequired: number;
      status: string;
    };
  }> {
    const scoreData = await this.getStaffMonthlyScore(clinicId, staffId, year, month);

    if (!scoreData) {
      return { allowed: true };
    }

    let allowed = false;
    let myCount = 0;
    let average = 0;
    let minRequired = 0;
    let status = '';

    const analysis = await this.getMonthlyFairnessAnalysis(clinicId, year, month);

    switch (fairnessType) {
      case 'night':
        allowed = scoreData.canApplyNightOff;
        myCount = scoreData.nightShiftCount;
        average = analysis.nightShift.average;
        minRequired = analysis.nightShift.min;
        status = scoreData.nightShiftStatus;
        break;
      case 'weekend':
        allowed = scoreData.canApplyWeekendOff;
        myCount = scoreData.weekendCount;
        average = analysis.weekend.average;
        minRequired = analysis.weekend.min;
        status = scoreData.weekendStatus;
        break;
      case 'holiday':
        allowed = scoreData.canApplyHolidayOff;
        myCount = scoreData.holidayCount;
        average = analysis.holiday.average;
        minRequired = analysis.holiday.min;
        status = scoreData.holidayStatus;
        break;
      case 'holidayAdjacent':
        allowed = scoreData.canApplyHolidayAdjacentOff;
        myCount = scoreData.holidayAdjacentCount;
        average = analysis.holidayAdjacent.average;
        minRequired = analysis.holidayAdjacent.min;
        status = scoreData.holidayAdjacentStatus;
        break;
    }

    if (!allowed) {
      const typeKorean = {
        night: '야간',
        weekend: '주말',
        holiday: '공휴일',
        holidayAdjacent: '공휴일 전후',
      }[fairnessType];

      return {
        allowed: false,
        reason: `이번 달 ${typeKorean} 근무 횟수가 평균보다 부족하여 오프를 신청할 수 없습니다.`,
        details: {
          myCount,
          average,
          minRequired,
          status,
        },
      };
    }

    return {
      allowed: true,
      details: {
        myCount,
        average,
        minRequired,
        status,
      },
    };
  }

  /**
   * 형평성 점수 업데이트 또는 증가
   */
  async updateFairnessScore(
    staffId: string,
    year: number,
    month: number,
    fairnessType: 'night' | 'weekend' | 'holiday' | 'holidayAdjacent',
    increment: number = 1
  ): Promise<void> {
    const existing = await prisma.fairnessScore.findUnique({
      where: {
        staffId_year_month: {
          staffId,
          year,
          month,
        },
      },
    });

    const fieldMap = {
      night: 'nightShiftCount',
      weekend: 'weekendCount',
      holiday: 'holidayCount',
      holidayAdjacent: 'holidayAdjacentCount',
    };

    const field = fieldMap[fairnessType];

    if (existing) {
      await prisma.fairnessScore.update({
        where: { id: existing.id },
        data: {
          [field]: existing[field as keyof typeof existing] as number + increment,
        },
      });
    } else {
      await prisma.fairnessScore.create({
        data: {
          staffId,
          year,
          month,
          [field]: increment,
        },
      });
    }
  }

  /**
   * 여러 형평성 타입을 한번에 업데이트 (중복 카운트용)
   */
  async updateMultipleFairnessScores(
    staffId: string,
    year: number,
    month: number,
    fairnessTypes: Array<'night' | 'weekend' | 'holiday' | 'holidayAdjacent'>
  ): Promise<void> {
    for (const type of fairnessTypes) {
      await this.updateFairnessScore(staffId, year, month, type, 1);
    }
  }
}

// 싱글톤 인스턴스 export
export const monthlyFairnessServiceV2 = new MonthlyFairnessServiceV2();
