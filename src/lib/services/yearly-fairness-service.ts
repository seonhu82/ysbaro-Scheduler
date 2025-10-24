/**
 * 연별 형평성 분석 서비스
 *
 * 목적: 연단위 누적 목표 기반 형평성 관리
 * - 1월부터 현재 월까지의 누적 야간/주말 근무 목표 계산
 * - 직원별 실적과 목표 비교
 * - 우선 배정 대상 식별
 */

import { prisma } from '@/lib/prisma';

export interface CumulativeTarget {
  year: number;
  month: number;
  totalShifts: number;        // 누적 총 야간/주말 일수
  totalNeeds: number;         // 누적 총 필요 인원
  activeEmployees: number;    // 활성 직원 수
  targetPerEmployee: number;  // 직원 1인당 누적 목표
  breakdown: MonthlyBreakdown[];
}

export interface MonthlyBreakdown {
  month: number;
  shifts: number;  // 해당 월의 야간/주말 일수
  needs: number;   // 해당 월의 필요 인원
}

export type ShiftStatus = 'behind' | 'on_track' | 'ahead';

export interface EmployeeFairnessData {
  name: string;
  currentCount: number;  // 현재까지 실적
  target: number;        // 누적 목표
  diff: number;          // 차이 (음수=부족, 양수=초과)
  priority: number;      // 우선순위 (낮을수록 우선)
  status: ShiftStatus;   // 상태
}

export interface FairnessAnalysisResult {
  year: number;
  month: number;
  cumulativeTarget: CumulativeTarget;
  employees: Record<string, EmployeeFairnessData>;
}

export interface Recommendation {
  type: 'night_shift_priority' | 'night_shift_reduce' | 'weekend_priority' | 'weekend_reduce' | 'achievement';
  priority: 'high' | 'medium' | 'info';
  message: string;
  employeeIds: string[];
  details?: string;
}

export interface ComprehensiveFairnessReport {
  year: number;
  month: number;
  nightShift: FairnessAnalysisResult;
  weekendWork: FairnessAnalysisResult;
  holidayWork: FairnessAnalysisResult;
  holidayAdjacent: FairnessAnalysisResult;
  recommendations: Recommendation[];
}

export class YearlyFairnessService {
  /**
   * 누적 목표 계산 (해당 월까지)
   *
   * @param year 연도
   * @param month 월 (1~12)
   * @param shiftType 'night' (야간), 'weekend' (주말), 'holiday' (공휴일), 'holiday_adjacent' (공휴일 전후)
   * @returns 누적 목표 정보
   */
  async calculateCumulativeTarget(
    year: number,
    month: number,
    shiftType: 'night' | 'weekend' | 'holiday' | 'holiday_adjacent'
  ): Promise<CumulativeTarget> {
    let totalShifts = 0;
    let totalNeeds = 0;
    const breakdown: MonthlyBreakdown[] = [];

    // 1월부터 해당 월까지 반복
    for (let m = 1; m <= month; m++) {
      const startDate = new Date(year, m - 1, 1);
      const endDate = new Date(year, m, 0); // 해당 월의 마지막 날

      let schedules: any[] = [];

      if (shiftType === 'night') {
        // 해당 월의 야간 진료일 조회
        schedules = await prisma.dailySlot.findMany({
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
            week: {
              // 야간 진료가 있는 날짜만 필터링
              // DailySchedule의 hasNightShift 정보가 필요
              // 현재는 WeekInfo를 통해 접근
            },
          },
          include: {
            week: true,
          },
        });

        // 실제로는 DoctorSchedule 또는 Schedule에서 야간 여부 확인 필요
        // 임시로 요일 기준 (월~금을 야간으로 가정)
        schedules = schedules.filter(slot => {
          const dayOfWeek = slot.date.getDay();
          return dayOfWeek >= 1 && dayOfWeek <= 5; // 월~금
        });
      } else if (shiftType === 'weekend') {
        // 주말 (토요일만, 일요일은 전원 휴무)
        schedules = await prisma.dailySlot.findMany({
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
            dayType: 'SATURDAY',
          },
        });
      } else if (shiftType === 'holiday') {
        // 공휴일 (일요일 제외)
        schedules = await prisma.dailySlot.findMany({
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
            dayType: {
              in: ['HOLIDAY', 'HOLIDAY_ADJACENT_SUNDAY']
            }
          },
        });
      } else if (shiftType === 'holiday_adjacent') {
        // 공휴일 전후 (일요일 포함)
        schedules = await prisma.dailySlot.findMany({
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
            dayType: {
              in: ['HOLIDAY_ADJACENT', 'HOLIDAY_ADJACENT_SUNDAY']
            }
          },
        });
      } else {
        schedules = [];
      }

      const monthShifts = schedules.length;
      const monthNeeds = schedules.reduce((sum, s) => sum + s.requiredStaff, 0);

      totalShifts += monthShifts;
      totalNeeds += monthNeeds;

      breakdown.push({
        month: m,
        shifts: monthShifts,
        needs: monthNeeds,
      });
    }

    // 활성 직원 수
    const activeEmployees = await prisma.staff.count({
      where: { isActive: true },
    });

    // 직원 1인당 목표
    const targetPerEmployee = activeEmployees > 0 ? totalNeeds / activeEmployees : 0;

    return {
      year,
      month,
      totalShifts,
      totalNeeds,
      activeEmployees,
      targetPerEmployee: Math.round(targetPerEmployee * 100) / 100,
      breakdown,
    };
  }

  /**
   * 야간 근무 형평성 분석
   *
   * @param year 연도
   * @param month 월 (1~12)
   * @returns 야간 근무 형평성 분석 결과
   */
  async getNightShiftFairness(year: number, month: number): Promise<FairnessAnalysisResult> {
    // 누적 목표 계산
    const cumulativeTarget = await this.calculateCumulativeTarget(year, month, 'night');
    const target = cumulativeTarget.targetPerEmployee;

    // 활성 직원 조회
    const staffList = await prisma.staff.findMany({
      where: { isActive: true },
      include: {
        fairnessScores: {
          where: {
            year,
            month: { lte: month },
          },
        },
      },
    });

    const employees: Record<string, EmployeeFairnessData> = {};

    for (const staff of staffList) {
      // 해당 월까지의 야간 근무 횟수 합산
      const currentCount = staff.fairnessScores.reduce(
        (sum, score) => sum + score.nightShiftCount,
        0
      );

      const diff = currentCount - target;

      // 상태 판정
      let status: ShiftStatus;
      if (diff < -2) {
        status = 'behind'; // 2회 이상 부족
      } else if (diff > 2) {
        status = 'ahead'; // 2회 이상 초과
      } else {
        status = 'on_track'; // 적정 범위
      }

      employees[staff.id] = {
        name: staff.name,
        currentCount,
        target,
        diff: Math.round(diff * 100) / 100,
        priority: diff, // 우선순위 = 차이값 (음수일수록 우선)
        status,
      };
    }

    return {
      year,
      month,
      cumulativeTarget,
      employees,
    };
  }

  /**
   * 주말 근무 형평성 분석
   *
   * @param year 연도
   * @param month 월 (1~12)
   * @returns 주말 근무 형평성 분석 결과
   */
  async getWeekendWorkFairness(year: number, month: number): Promise<FairnessAnalysisResult> {
    // 누적 목표 계산
    const cumulativeTarget = await this.calculateCumulativeTarget(year, month, 'weekend');
    const target = cumulativeTarget.targetPerEmployee;

    // 활성 직원 조회
    const staffList = await prisma.staff.findMany({
      where: { isActive: true },
      include: {
        fairnessScores: {
          where: {
            year,
            month: { lte: month },
          },
        },
      },
    });

    const employees: Record<string, EmployeeFairnessData> = {};

    for (const staff of staffList) {
      // 해당 월까지의 주말 근무 횟수 합산
      const currentCount = staff.fairnessScores.reduce(
        (sum, score) => sum + score.weekendCount,
        0
      );

      const diff = currentCount - target;

      // 상태 판정
      let status: ShiftStatus;
      if (diff < -2) {
        status = 'behind';
      } else if (diff > 2) {
        status = 'ahead';
      } else {
        status = 'on_track';
      }

      employees[staff.id] = {
        name: staff.name,
        currentCount,
        target,
        diff: Math.round(diff * 100) / 100,
        priority: diff,
        status,
      };
    }

    return {
      year,
      month,
      cumulativeTarget,
      employees,
    };
  }

  /**
   * 공휴일 근무 형평성 분석
   *
   * @param year 연도
   * @param month 월 (1~12)
   * @returns 공휴일 근무 형평성 분석 결과
   */
  async getHolidayWorkFairness(year: number, month: number): Promise<FairnessAnalysisResult> {
    // 누적 목표 계산
    const cumulativeTarget = await this.calculateCumulativeTarget(year, month, 'holiday');
    const target = cumulativeTarget.targetPerEmployee;

    // 활성 직원 조회
    const staffList = await prisma.staff.findMany({
      where: { isActive: true },
      include: {
        fairnessScores: {
          where: {
            year,
            month: { lte: month },
          },
        },
      },
    });

    const employees: Record<string, EmployeeFairnessData> = {};

    for (const staff of staffList) {
      // 해당 월까지의 공휴일 근무 횟수 합산
      const currentCount = staff.fairnessScores.reduce(
        (sum, score) => sum + score.holidayCount,
        0
      );

      const diff = currentCount - target;

      // 상태 판정 (공휴일은 빈도가 낮으므로 1회 기준)
      let status: ShiftStatus;
      if (diff < -1) {
        status = 'behind';
      } else if (diff > 1) {
        status = 'ahead';
      } else {
        status = 'on_track';
      }

      employees[staff.id] = {
        name: staff.name,
        currentCount,
        target,
        diff: Math.round(diff * 100) / 100,
        priority: diff,
        status,
      };
    }

    return {
      year,
      month,
      cumulativeTarget,
      employees,
    };
  }

  /**
   * 공휴일 전후 근무 형평성 분석
   *
   * @param year 연도
   * @param month 월 (1~12)
   * @returns 공휴일 전후 근무 형평성 분석 결과
   */
  async getHolidayAdjacentFairness(year: number, month: number): Promise<FairnessAnalysisResult> {
    // 누적 목표 계산
    const cumulativeTarget = await this.calculateCumulativeTarget(year, month, 'holiday_adjacent');
    const target = cumulativeTarget.targetPerEmployee;

    // 활성 직원 조회
    const staffList = await prisma.staff.findMany({
      where: { isActive: true },
      include: {
        fairnessScores: {
          where: {
            year,
            month: { lte: month },
          },
        },
      },
    });

    const employees: Record<string, EmployeeFairnessData> = {};

    for (const staff of staffList) {
      // 해당 월까지의 공휴일 전후 근무 횟수 합산
      const currentCount = staff.fairnessScores.reduce(
        (sum, score) => sum + score.holidayAdjacentCount,
        0
      );

      const diff = currentCount - target;

      // 상태 판정
      let status: ShiftStatus;
      if (diff < -1) {
        status = 'behind';
      } else if (diff > 1) {
        status = 'ahead';
      } else {
        status = 'on_track';
      }

      employees[staff.id] = {
        name: staff.name,
        currentCount,
        target,
        diff: Math.round(diff * 100) / 100,
        priority: diff,
        status,
      };
    }

    return {
      year,
      month,
      cumulativeTarget,
      employees,
    };
  }

  /**
   * 권장 사항 생성
   *
   * @param nightFairness 야간 근무 형평성
   * @param weekendFairness 주말 근무 형평성
   * @returns 권장 사항 목록
   */
  generateRecommendations(
    nightFairness: FairnessAnalysisResult,
    weekendFairness: FairnessAnalysisResult
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 야간 근무 권장
    const nightBehind = Object.entries(nightFairness.employees)
      .filter(([_, data]) => data.status === 'behind')
      .sort((a, b) => a[1].priority - b[1].priority);

    if (nightBehind.length > 0) {
      const names = nightBehind.slice(0, 5).map(([_, data]) => data.name);
      recommendations.push({
        type: 'night_shift_priority',
        priority: 'high',
        message: `야간 근무 우선 배정 권장: ${names.join(', ')}`,
        employeeIds: nightBehind.slice(0, 5).map(([id, _]) => id),
        details: `목표 대비 부족 인원 ${nightBehind.length}명`,
      });
    }

    const nightAhead = Object.entries(nightFairness.employees)
      .filter(([_, data]) => data.status === 'ahead')
      .sort((a, b) => b[1].priority - a[1].priority);

    if (nightAhead.length > 0) {
      const names = nightAhead.slice(0, 5).map(([_, data]) => data.name);
      recommendations.push({
        type: 'night_shift_reduce',
        priority: 'medium',
        message: `야간 근무 배정 자제 권장: ${names.join(', ')}`,
        employeeIds: nightAhead.slice(0, 5).map(([id, _]) => id),
        details: `목표 초과 인원 ${nightAhead.length}명`,
      });
    }

    // 주말 근무 권장
    const weekendBehind = Object.entries(weekendFairness.employees)
      .filter(([_, data]) => data.status === 'behind')
      .sort((a, b) => a[1].priority - b[1].priority);

    if (weekendBehind.length > 0) {
      const names = weekendBehind.slice(0, 5).map(([_, data]) => data.name);
      recommendations.push({
        type: 'weekend_priority',
        priority: 'high',
        message: `주말 근무 우선 배정 권장: ${names.join(', ')}`,
        employeeIds: weekendBehind.slice(0, 5).map(([id, _]) => id),
        details: `목표 대비 부족 인원 ${weekendBehind.length}명`,
      });
    }

    const weekendAhead = Object.entries(weekendFairness.employees)
      .filter(([_, data]) => data.status === 'ahead')
      .sort((a, b) => b[1].priority - a[1].priority);

    if (weekendAhead.length > 0) {
      const names = weekendAhead.slice(0, 5).map(([_, data]) => data.name);
      recommendations.push({
        type: 'weekend_reduce',
        priority: 'medium',
        message: `주말 근무 배정 자제 권장: ${names.join(', ')}`,
        employeeIds: weekendAhead.slice(0, 5).map(([id, _]) => id),
        details: `목표 초과 인원 ${weekendAhead.length}명`,
      });
    }

    // 형평성 달성
    const nightOnTrack = Object.values(nightFairness.employees).filter(
      (data) => data.status === 'on_track'
    ).length;
    const totalEmployees = Object.keys(nightFairness.employees).length;

    if (totalEmployees > 0 && nightOnTrack / totalEmployees > 0.8) {
      recommendations.push({
        type: 'achievement',
        priority: 'info',
        message: `야간 근무 형평성 우수! (${nightOnTrack}/${totalEmployees}명 적정 범위)`,
        employeeIds: [],
      });
    }

    return recommendations;
  }

  /**
   * 종합 형평성 리포트
   *
   * @param year 연도
   * @param month 월 (1~12)
   * @returns 종합 형평성 리포트
   */
  async getComprehensiveFairnessReport(
    year: number,
    month: number
  ): Promise<ComprehensiveFairnessReport> {
    const nightShiftFairness = await this.getNightShiftFairness(year, month);
    const weekendFairness = await this.getWeekendWorkFairness(year, month);
    const holidayFairness = await this.getHolidayWorkFairness(year, month);
    const holidayAdjacentFairness = await this.getHolidayAdjacentFairness(year, month);

    const recommendations = this.generateRecommendations(nightShiftFairness, weekendFairness);

    return {
      year,
      month,
      nightShift: nightShiftFairness,
      weekendWork: weekendFairness,
      holidayWork: holidayFairness,
      holidayAdjacent: holidayAdjacentFairness,
      recommendations,
    };
  }
}

// 싱글톤 인스턴스 export
export const yearlyFairnessService = new YearlyFairnessService();
