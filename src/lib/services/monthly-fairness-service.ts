/**
 * 월별 형평성 점수 계산 서비스
 *
 * 목적: 월별 야간/주말/공휴일 근무 횟수를 기반으로 형평성 점수 계산
 * - 가중치 적용하여 점수 산정
 * - 평균 점수와 비교
 * - 오프 신청 제한 판단
 */

import { prisma } from '@/lib/prisma';

export interface FairnessScoreData {
  staffId: string;
  staffName: string;
  nightShiftCount: number;
  weekendCount: number;
  holidayCount: number;
  totalScore: number;
  status: 'low' | 'normal' | 'high';
  canApplyNightOff: boolean;
  canApplyWeekendOff: boolean;
}

export interface MonthlyFairnessAnalysis {
  year: number;
  month: number;
  averageScore: number;
  minRequired: number;      // 최소 필요 점수
  maxAllowed: number;       // 최대 허용 점수
  fairnessThreshold: number;
  weights: {
    nightShift: number;
    weekend: number;
    holiday: number;
  };
  scores: FairnessScoreData[];
}

export interface FairnessSettings {
  nightShiftWeight: number;
  weekendWeight: number;
  holidayWeight: number;
  enableFairnessCheck: boolean;
  fairnessThreshold: number;
}

export class MonthlyFairnessService {
  /**
   * 형평성 설정 조회
   *
   * @param clinicId 병원 ID
   * @returns 형평성 설정
   */
  async getFairnessSettings(clinicId: string): Promise<FairnessSettings> {
    const settings = await prisma.fairnessSettings.findUnique({
      where: { clinicId },
    });

    if (!settings) {
      // 기본값 반환
      return {
        nightShiftWeight: 2.0,
        weekendWeight: 1.5,
        holidayWeight: 2.0,
        enableFairnessCheck: true,
        fairnessThreshold: 0.2,
      };
    }

    return {
      nightShiftWeight: settings.nightShiftWeight,
      weekendWeight: settings.weekendWeight,
      holidayWeight: settings.holidayWeight,
      enableFairnessCheck: settings.enableFairnessCheck,
      fairnessThreshold: settings.fairnessThreshold,
    };
  }

  /**
   * 형평성 점수 계산
   *
   * @param nightShiftCount 야간 근무 횟수
   * @param weekendCount 주말 근무 횟수
   * @param holidayCount 공휴일 근무 횟수
   * @param weights 가중치
   * @returns 총 점수
   */
  calculateScore(
    nightShiftCount: number,
    weekendCount: number,
    holidayCount: number,
    weights: { nightShift: number; weekend: number; holiday: number }
  ): number {
    return (
      nightShiftCount * weights.nightShift +
      weekendCount * weights.weekend +
      holidayCount * weights.holiday
    );
  }

  /**
   * 월별 형평성 점수 조회 (모든 직원)
   *
   * @param clinicId 병원 ID
   * @param year 연도
   * @param month 월
   * @returns 월별 형평성 분석 결과
   */
  async getMonthlyFairnessAnalysis(
    clinicId: string,
    year: number,
    month: number
  ): Promise<MonthlyFairnessAnalysis> {
    // 형평성 설정 조회
    const settings = await this.getFairnessSettings(clinicId);

    if (!settings.enableFairnessCheck) {
      // 형평성 체크 비활성화된 경우 빈 결과 반환
      return {
        year,
        month,
        averageScore: 0,
        minRequired: 0,
        maxAllowed: 0,
        fairnessThreshold: settings.fairnessThreshold,
        weights: {
          nightShift: settings.nightShiftWeight,
          weekend: settings.weekendWeight,
          holiday: settings.holidayWeight,
        },
        scores: [],
      };
    }

    // 활성 직원 조회
    const staffList = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
      },
      include: {
        fairnessScores: {
          where: {
            year,
            month,
          },
        },
      },
    });

    const scores: FairnessScoreData[] = [];
    let totalScore = 0;

    for (const staff of staffList) {
      const score = staff.fairnessScores[0];

      const nightShiftCount = score?.nightShiftCount ?? 0;
      const weekendCount = score?.weekendCount ?? 0;
      const holidayCount = score?.holidayCount ?? 0;

      const totalStaffScore = this.calculateScore(
        nightShiftCount,
        weekendCount,
        holidayCount,
        {
          nightShift: settings.nightShiftWeight,
          weekend: settings.weekendWeight,
          holiday: settings.holidayWeight,
        }
      );

      totalScore += totalStaffScore;

      scores.push({
        staffId: staff.id,
        staffName: staff.name,
        nightShiftCount,
        weekendCount,
        holidayCount,
        totalScore: totalStaffScore,
        status: 'normal', // 나중에 계산
        canApplyNightOff: true, // 나중에 계산
        canApplyWeekendOff: true, // 나중에 계산
      });
    }

    // 평균 점수
    const averageScore = staffList.length > 0 ? totalScore / staffList.length : 0;

    // 최소/최대 허용 점수
    const minRequired = averageScore * (1 - settings.fairnessThreshold);
    const maxAllowed = averageScore * (1 + settings.fairnessThreshold);

    // 각 직원의 상태 및 신청 가능 여부 업데이트
    for (const scoreData of scores) {
      if (scoreData.totalScore < minRequired) {
        scoreData.status = 'low';
        scoreData.canApplyNightOff = false;
        scoreData.canApplyWeekendOff = false;
      } else if (scoreData.totalScore > maxAllowed) {
        scoreData.status = 'high';
        scoreData.canApplyNightOff = true;
        scoreData.canApplyWeekendOff = true;
      } else {
        scoreData.status = 'normal';
        scoreData.canApplyNightOff = true;
        scoreData.canApplyWeekendOff = true;
      }
    }

    return {
      year,
      month,
      averageScore: Math.round(averageScore * 100) / 100,
      minRequired: Math.round(minRequired * 100) / 100,
      maxAllowed: Math.round(maxAllowed * 100) / 100,
      fairnessThreshold: settings.fairnessThreshold,
      weights: {
        nightShift: settings.nightShiftWeight,
        weekend: settings.weekendWeight,
        holiday: settings.holidayWeight,
      },
      scores,
    };
  }

  /**
   * 특정 직원의 월별 형평성 점수 조회
   *
   * @param clinicId 병원 ID
   * @param staffId 직원 ID
   * @param year 연도
   * @param month 월
   * @returns 형평성 점수 데이터 또는 null
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
   * 형평성 점수 업데이트 (스케줄 확정 시 호출)
   *
   * @param clinicId 병원 ID
   * @param year 연도
   * @param month 월
   */
  async updateFairnessScores(clinicId: string, year: number, month: number): Promise<void> {
    const settings = await this.getFairnessSettings(clinicId);

    if (!settings.enableFairnessCheck) {
      return;
    }

    // 활성 직원 조회
    const staffList = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
      },
    });

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    for (const staff of staffList) {
      let nightShiftCount = 0;
      let weekendCount = 0;
      let holidayCount = 0;

      // 해당 월의 모든 근무일 조회
      // 여기서는 DailySlot과 스케줄 데이터를 기반으로 계산
      // 실제 구현 시 Schedule과 연동 필요

      // TODO: 실제 스케줄 데이터에서 야간/주말/공휴일 근무 횟수 집계
      // 현재는 임시 로직

      const totalScore = this.calculateScore(nightShiftCount, weekendCount, holidayCount, {
        nightShift: settings.nightShiftWeight,
        weekend: settings.weekendWeight,
        holiday: settings.holidayWeight,
      });

      // DB에 저장 (upsert)
      await prisma.fairnessScore.upsert({
        where: {
          staffId_year_month: {
            staffId: staff.id,
            year,
            month,
          },
        },
        update: {
          nightShiftCount,
          weekendCount,
          holidayCount,
          totalScore,
          updatedAt: new Date(),
        },
        create: {
          staffId: staff.id,
          year,
          month,
          nightShiftCount,
          weekendCount,
          holidayCount,
          totalScore,
        },
      });
    }
  }

  /**
   * 특정 직원의 오프 신청 가능 여부 확인 (월별 기준)
   *
   * @param clinicId 병원 ID
   * @param staffId 직원 ID
   * @param year 연도
   * @param month 월
   * @param offType 'night' (야간) 또는 'weekend' (주말)
   * @returns 신청 가능 여부 및 상세 정보
   */
  async canApplyOff(
    clinicId: string,
    staffId: string,
    year: number,
    month: number,
    offType: 'night' | 'weekend'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    details?: {
      myScore: number;
      averageScore: number;
      minRequired: number;
      nightShiftCount: number;
      weekendCount: number;
      holidayCount: number;
    };
  }> {
    const scoreData = await this.getStaffMonthlyScore(clinicId, staffId, year, month);

    if (!scoreData) {
      // 점수가 없으면 신청 가능 (첫 달 등)
      return { allowed: true };
    }

    const analysis = await this.getMonthlyFairnessAnalysis(clinicId, year, month);

    if (scoreData.status === 'low') {
      return {
        allowed: false,
        reason: `이번 달 야간/주말 근무가 부족하여 해당 날짜에 오프를 신청할 수 없습니다.`,
        details: {
          myScore: scoreData.totalScore,
          averageScore: analysis.averageScore,
          minRequired: analysis.minRequired,
          nightShiftCount: scoreData.nightShiftCount,
          weekendCount: scoreData.weekendCount,
          holidayCount: scoreData.holidayCount,
        },
      };
    }

    return {
      allowed: true,
      details: {
        myScore: scoreData.totalScore,
        averageScore: analysis.averageScore,
        minRequired: analysis.minRequired,
        nightShiftCount: scoreData.nightShiftCount,
        weekendCount: scoreData.weekendCount,
        holidayCount: scoreData.holidayCount,
      },
    };
  }
}

// 싱글톤 인스턴스 export
export const monthlyFairnessService = new MonthlyFairnessService();
