/**
 * 형평성 기반 오프 신청 검증 서비스 (개선 버전)
 *
 * 이중 검증 시스템:
 * 1. 월별 최소 요구: 해당 월에 반드시 근무해야 하는 최소 횟수
 * 2. 연간 형평성: 1월부터 현재까지 누적 근무가 평균 이상인지 확인
 */

import { prisma } from '@/lib/prisma';

export type DateType = 'NORMAL_WEEKDAY' | 'NIGHT_WEEKDAY' | 'WEEKEND' | 'HOLIDAY' | 'SUNDAY';

export interface MonthlyRequirement {
  year: number;
  month: number;
  shiftType: 'night' | 'weekend';
  totalDays: number;           // 해당 월의 야간/주말 총 일수
  requiredStaffPerDay: number; // 일당 필요 인원
  totalNeeds: number;          // 총 필요 인원 (총일수 × 일당인원)
  activeStaff: number;         // 활성 직원 수
  requiredPerStaff: number;    // 직원 1인당 필요 근무 횟수
}

export interface YearlyCumulative {
  year: number;
  month: number;                // 해당 월까지
  shiftType: 'night' | 'weekend';
  cumulativeDays: number;       // 1월~해당월 누적 총 일수
  cumulativeNeeds: number;      // 1월~해당월 누적 총 필요 인원
  activeStaff: number;
  cumulativeRequired: number;   // 직원 1인당 누적 필요 근무 횟수
  allowedDeviation: number;     // 허용 오차 (기본 2회)
}

export interface StaffShiftStatus {
  staffId: string;
  staffName: string;

  // 월별 현황
  monthly: {
    scheduled: number;          // 이미 배정된 근무
    offRequested: number;       // 이미 신청한 오프
    actual: number;             // 실제 근무 예정 (scheduled - offRequested)
    required: number;           // 필요 근무 횟수
    canRequestOff: boolean;     // 월별 기준 오프 신청 가능 여부
  };

  // 연간 현황
  yearly: {
    cumulativeActual: number;   // 1월~현재까지 실제 근무
    cumulativeRequired: number; // 1월~현재까지 필요 근무
    diff: number;               // 차이 (actual - required)
    status: 'behind' | 'on_track' | 'ahead';
    canRequestOff: boolean;     // 연간 기준 오프 신청 가능 여부
  };
}

export interface ValidationResult {
  allowed: boolean;
  requiresFairnessCheck: boolean;
  reason?: 'MONTHLY_MINIMUM_NOT_MET' | 'YEARLY_FAIRNESS_LOW' | 'BOTH_FAILED';
  message?: string;
  details?: {
    monthly?: MonthlyRequirement & StaffShiftStatus['monthly'];
    yearly?: YearlyCumulative & StaffShiftStatus['yearly'];
  };
}

export class FairnessValidationService {
  /**
   * 날짜 유형 판단
   */
  getDateType(date: Date, hasNightShift: boolean, isHoliday: boolean): DateType {
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0) return 'SUNDAY';
    if (isHoliday) return 'HOLIDAY';
    if (dayOfWeek === 6) return 'WEEKEND';
    if (hasNightShift) return 'NIGHT_WEEKDAY';
    return 'NORMAL_WEEKDAY';
  }

  /**
   * 월별 필요 근무 횟수 계산
   *
   * @param clinicId 병원 ID
   * @param year 연도
   * @param month 월
   * @param shiftType 'night' (야간) 또는 'weekend' (주말)
   */
  async calculateMonthlyRequirement(
    clinicId: string,
    year: number,
    month: number,
    shiftType: 'night' | 'weekend'
  ): Promise<MonthlyRequirement> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let totalDays = 0;
    let totalNeeds = 0;

    if (shiftType === 'night') {
      // 야간 진료일 조회
      const schedules = await prisma.dailySlot.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          week: { clinicId },
        },
        include: { week: true },
      });

      // 월~금만 필터링 (야간 진료일)
      const nightSchedules = schedules.filter(s => {
        const day = s.date.getDay();
        return day >= 1 && day <= 5;
      });

      totalDays = nightSchedules.length;
      totalNeeds = nightSchedules.reduce((sum, s) => sum + s.requiredStaff, 0);
    } else {
      // 주말 (토요일만)
      const weekendSchedules = await prisma.dailySlot.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          week: { clinicId },
        },
      });

      totalDays = weekendSchedules.length;
      totalNeeds = weekendSchedules.reduce((sum, s) => sum + s.requiredStaff, 0);
    }

    const activeStaff = await prisma.staff.count({
      where: { clinicId, isActive: true },
    });

    const requiredStaffPerDay = totalDays > 0 ? totalNeeds / totalDays : 0;
    const requiredPerStaff = activeStaff > 0 ? totalNeeds / activeStaff : 0;

    return {
      year,
      month,
      shiftType,
      totalDays,
      requiredStaffPerDay,
      totalNeeds,
      activeStaff,
      requiredPerStaff: Math.ceil(requiredPerStaff), // 올림
    };
  }

  /**
   * 연간 누적 필요 근무 횟수 계산
   *
   * @param clinicId 병원 ID
   * @param year 연도
   * @param month 월 (해당 월까지 계산)
   * @param shiftType 'night' (야간) 또는 'weekend' (주말)
   */
  async calculateYearlyCumulative(
    clinicId: string,
    year: number,
    month: number,
    shiftType: 'night' | 'weekend'
  ): Promise<YearlyCumulative> {
    let cumulativeDays = 0;
    let cumulativeNeeds = 0;

    for (let m = 1; m <= month; m++) {
      const monthlyReq = await this.calculateMonthlyRequirement(clinicId, year, m, shiftType);
      cumulativeDays += monthlyReq.totalDays;
      cumulativeNeeds += monthlyReq.totalNeeds;
    }

    const activeStaff = await prisma.staff.count({
      where: { clinicId, isActive: true },
    });

    const cumulativeRequired = activeStaff > 0 ? cumulativeNeeds / activeStaff : 0;

    return {
      year,
      month,
      shiftType,
      cumulativeDays,
      cumulativeNeeds,
      activeStaff,
      cumulativeRequired: Math.round(cumulativeRequired * 100) / 100,
      allowedDeviation: 2, // 2회 허용 오차
    };
  }

  /**
   * 직원의 월별 근무 현황 조회
   *
   * @param staffId 직원 ID
   * @param year 연도
   * @param month 월
   * @param shiftType 'night' (야간) 또는 'weekend' (주말)
   */
  async getStaffMonthlyStatus(
    staffId: string,
    year: number,
    month: number,
    shiftType: 'night' | 'weekend'
  ): Promise<{ scheduled: number; offRequested: number; actual: number }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // 이미 배정된 근무 (DailyStaffAssignment에서 조회)
    const assignments = await prisma.dailyStaffAssignment.findMany({
      where: {
        staffId,
        dailySlot: {
          date: { gte: startDate, lte: endDate },
        },
      },
      include: {
        dailySlot: {
          select: {
            date: true,
            dayType: true,
            doctorSchedule: true,
          },
        },
      },
    });

    // shiftType에 맞는 배정만 카운트
    let scheduled = 0;
    for (const assignment of assignments) {
      const date = assignment.dailySlot.date;
      const dayOfWeek = date.getDay();
      const doctorSchedule = assignment.dailySlot.doctorSchedule as { night_shift?: boolean } | null;
      const hasNightShift = doctorSchedule?.night_shift || false;

      if (shiftType === 'night') {
        // 야간 근무: 월~금 중 야간 진료일
        if (dayOfWeek >= 1 && dayOfWeek <= 5 && hasNightShift) {
          scheduled++;
        }
      } else if (shiftType === 'weekend') {
        // 주말 근무: 토요일
        if (dayOfWeek === 6) {
          scheduled++;
        }
      }
    }

    // 이미 신청한 오프 (LeaveApplication에서 조회)
    const offApplications = await prisma.leaveApplication.findMany({
      where: {
        staffId,
        date: { gte: startDate, lte: endDate },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    let offRequested = 0;
    for (const app of offApplications) {
      const dayOfWeek = app.date.getDay();

      // hasNightShift와 isHoliday 정보 조회
      const dailySlot = await prisma.dailySlot.findFirst({
        where: {
          date: {
            gte: new Date(app.date.setHours(0, 0, 0, 0)),
            lte: new Date(app.date.setHours(23, 59, 59, 999)),
          },
        },
        select: {
          doctorSchedule: true,
        },
      });

      const doctorSchedule = dailySlot?.doctorSchedule as { night_shift?: boolean } | null;
      const hasNightShift = doctorSchedule?.night_shift || false;

      const holiday = await prisma.holiday.findFirst({
        where: {
          date: {
            gte: new Date(app.date.setHours(0, 0, 0, 0)),
            lte: new Date(app.date.setHours(23, 59, 59, 999)),
          },
        },
      });
      const isHoliday = !!holiday;

      const dateType = this.getDateType(app.date, hasNightShift, isHoliday);
      if (shiftType === 'night' && dateType === 'NIGHT_WEEKDAY') {
        offRequested++;
      } else if (shiftType === 'weekend' && dateType === 'WEEKEND') {
        offRequested++;
      }
    }

    return {
      scheduled,
      offRequested,
      actual: Math.max(0, scheduled - offRequested),
    };
  }

  /**
   * 직원의 연간 누적 근무 현황 조회
   *
   * @param staffId 직원 ID
   * @param year 연도
   * @param month 월 (해당 월까지)
   * @param shiftType 'night' (야간) 또는 'weekend' (주말)
   */
  async getStaffYearlyStatus(
    staffId: string,
    year: number,
    month: number,
    shiftType: 'night' | 'weekend'
  ): Promise<number> {
    // FairnessScore에서 누적 조회
    const scores = await prisma.fairnessScore.findMany({
      where: {
        staffId,
        year,
        month: { lte: month },
      },
    });

    if (shiftType === 'night') {
      return scores.reduce((sum, s) => sum + s.nightShiftCount, 0);
    } else {
      return scores.reduce((sum, s) => sum + s.weekendCount, 0);
    }
  }

  /**
   * 날짜의 야간 진료 여부와 공휴일 여부 조회
   */
  async getDateInfo(
    clinicId: string,
    date: Date
  ): Promise<{ hasNightShift: boolean; isHoliday: boolean }> {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    // DailySlot에서 야간 진료 정보 조회
    const dailySlot = await prisma.dailySlot.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        week: { clinicId },
      },
      select: {
        doctorSchedule: true,
      },
    });

    const doctorSchedule = dailySlot?.doctorSchedule as { night_shift?: boolean } | null;
    const hasNightShift = doctorSchedule?.night_shift || false;

    // Holiday 테이블에서 공휴일 정보 조회
    const holiday = await prisma.holiday.findFirst({
      where: {
        clinicId,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });
    const isHoliday = !!holiday;

    return { hasNightShift, isHoliday };
  }

  /**
   * 직원의 오프 신청 가능 여부 검증 (이중 체크)
   *
   * @param clinicId 병원 ID
   * @param staffId 직원 ID
   * @param date 신청 날짜
   * @param hasNightShift 야간 진료 여부 (선택, 미제공 시 자동 조회)
   * @param isHoliday 공휴일 여부 (선택, 미제공 시 자동 조회)
   */
  async validateOffApplication(
    clinicId: string,
    staffId: string,
    date: Date,
    hasNightShift?: boolean,
    isHoliday?: boolean
  ): Promise<ValidationResult> {
    // hasNightShift 또는 isHoliday가 제공되지 않은 경우 자동 조회
    let nightShift = hasNightShift;
    let holiday = isHoliday;

    if (nightShift === undefined || holiday === undefined) {
      const dateInfo = await this.getDateInfo(clinicId, date);
      nightShift = nightShift ?? dateInfo.hasNightShift;
      holiday = holiday ?? dateInfo.isHoliday;
    }
    // 1. 날짜 유형 판단
    const dateType = this.getDateType(date, nightShift, holiday);

    // 일반 평일이나 일요일은 형평성 체크 불필요
    if (dateType === 'NORMAL_WEEKDAY' || dateType === 'SUNDAY') {
      return { allowed: true, requiresFairnessCheck: false };
    }

    // 2. 형평성 설정 확인
    const settings = await prisma.fairnessSettings.findUnique({
      where: { clinicId },
    });

    // 모든 형평성 옵션이 비활성화되어 있으면 체크 불필요
    if (!settings || (!settings.enableNightShiftFairness && !settings.enableWeekendFairness && !settings.enableHolidayFairness && !settings.enableHolidayAdjacentFairness)) {
      return { allowed: true, requiresFairnessCheck: false };
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const shiftType = dateType === 'NIGHT_WEEKDAY' ? 'night' : 'weekend';

    // 3. 월별 최소 요구 체크
    const monthlyReq = await this.calculateMonthlyRequirement(clinicId, year, month, shiftType);
    const monthlyStatus = await this.getStaffMonthlyStatus(staffId, year, month, shiftType);

    const monthlyPassed = monthlyStatus.actual >= monthlyReq.requiredPerStaff;

    // 4. 연간 누적 형평성 체크
    const yearlyCum = await this.calculateYearlyCumulative(clinicId, year, month, shiftType);
    const yearlyActual = await this.getStaffYearlyStatus(staffId, year, month, shiftType);
    const yearlyDiff = yearlyActual - yearlyCum.cumulativeRequired;

    let yearlyStatus: 'behind' | 'on_track' | 'ahead';
    if (yearlyDiff < -yearlyCum.allowedDeviation) {
      yearlyStatus = 'behind';
    } else if (yearlyDiff > yearlyCum.allowedDeviation) {
      yearlyStatus = 'ahead';
    } else {
      yearlyStatus = 'on_track';
    }

    const yearlyPassed = yearlyStatus !== 'behind';

    // 5. 종합 판단
    if (!monthlyPassed && !yearlyPassed) {
      return {
        allowed: false,
        requiresFairnessCheck: true,
        reason: 'BOTH_FAILED',
        message: `이번 달 최소 근무 요구와 올해 누적 형평성을 모두 충족하지 못했습니다.`,
        details: {
          monthly: {
            ...monthlyReq,
            ...monthlyStatus,
            canRequestOff: false,
            required: monthlyReq.requiredPerStaff,
          },
          yearly: {
            ...yearlyCum,
            cumulativeActual: yearlyActual,
            diff: yearlyDiff,
            status: yearlyStatus,
            canRequestOff: false,
          },
        },
      };
    }

    if (!monthlyPassed) {
      return {
        allowed: false,
        requiresFairnessCheck: true,
        reason: 'MONTHLY_MINIMUM_NOT_MET',
        message: `이번 달 ${shiftType === 'night' ? '야간' : '주말'} 근무가 최소 ${monthlyReq.requiredPerStaff}회 필요합니다.`,
        details: {
          monthly: {
            ...monthlyReq,
            ...monthlyStatus,
            canRequestOff: false,
            required: monthlyReq.requiredPerStaff,
          },
        },
      };
    }

    if (!yearlyPassed) {
      return {
        allowed: false,
        requiresFairnessCheck: true,
        reason: 'YEARLY_FAIRNESS_LOW',
        message: `올해 누적 ${shiftType === 'night' ? '야간' : '주말'} 근무가 부족하여 형평성을 위해 오프를 신청할 수 없습니다.`,
        details: {
          yearly: {
            ...yearlyCum,
            cumulativeActual: yearlyActual,
            diff: yearlyDiff,
            status: yearlyStatus,
            canRequestOff: false,
          },
        },
      };
    }

    // 신청 가능
    return {
      allowed: true,
      requiresFairnessCheck: true,
      message: '신청 가능합니다.',
      details: {
        monthly: {
          ...monthlyReq,
          ...monthlyStatus,
          required: monthlyReq.requiredPerStaff,
          canRequestOff: true,
        },
        yearly: {
          ...yearlyCum,
          cumulativeActual: yearlyActual,
          diff: yearlyDiff,
          status: yearlyStatus,
          canRequestOff: true,
        },
      },
    };
  }

  /**
   * 직원의 종합 근무 현황 조회
   *
   * @param clinicId 병원 ID
   * @param staffId 직원 ID
   * @param year 연도
   * @param month 월
   */
  async getStaffShiftStatus(
    clinicId: string,
    staffId: string,
    year: number,
    month: number
  ): Promise<{
    night: StaffShiftStatus;
    weekend: StaffShiftStatus;
  }> {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });

    // 야간 현황
    const nightMonthlyReq = await this.calculateMonthlyRequirement(clinicId, year, month, 'night');
    const nightMonthlyStatus = await this.getStaffMonthlyStatus(staffId, year, month, 'night');
    const nightYearlyCum = await this.calculateYearlyCumulative(clinicId, year, month, 'night');
    const nightYearlyActual = await this.getStaffYearlyStatus(staffId, year, month, 'night');
    const nightYearlyDiff = nightYearlyActual - nightYearlyCum.cumulativeRequired;

    let nightYearlyStatus: 'behind' | 'on_track' | 'ahead';
    if (nightYearlyDiff < -nightYearlyCum.allowedDeviation) {
      nightYearlyStatus = 'behind';
    } else if (nightYearlyDiff > nightYearlyCum.allowedDeviation) {
      nightYearlyStatus = 'ahead';
    } else {
      nightYearlyStatus = 'on_track';
    }

    // 주말 현황
    const weekendMonthlyReq = await this.calculateMonthlyRequirement(
      clinicId,
      year,
      month,
      'weekend'
    );
    const weekendMonthlyStatus = await this.getStaffMonthlyStatus(staffId, year, month, 'weekend');
    const weekendYearlyCum = await this.calculateYearlyCumulative(clinicId, year, month, 'weekend');
    const weekendYearlyActual = await this.getStaffYearlyStatus(staffId, year, month, 'weekend');
    const weekendYearlyDiff = weekendYearlyActual - weekendYearlyCum.cumulativeRequired;

    let weekendYearlyStatus: 'behind' | 'on_track' | 'ahead';
    if (weekendYearlyDiff < -weekendYearlyCum.allowedDeviation) {
      weekendYearlyStatus = 'behind';
    } else if (weekendYearlyDiff > weekendYearlyCum.allowedDeviation) {
      weekendYearlyStatus = 'ahead';
    } else {
      weekendYearlyStatus = 'on_track';
    }

    return {
      night: {
        staffId,
        staffName: staff?.name || '',
        monthly: {
          ...nightMonthlyStatus,
          required: nightMonthlyReq.requiredPerStaff,
          canRequestOff:
            nightMonthlyStatus.actual >= nightMonthlyReq.requiredPerStaff &&
            nightYearlyStatus !== 'behind',
        },
        yearly: {
          cumulativeActual: nightYearlyActual,
          cumulativeRequired: nightYearlyCum.cumulativeRequired,
          diff: nightYearlyDiff,
          status: nightYearlyStatus,
          canRequestOff: nightYearlyStatus !== 'behind',
        },
      },
      weekend: {
        staffId,
        staffName: staff?.name || '',
        monthly: {
          ...weekendMonthlyStatus,
          required: weekendMonthlyReq.requiredPerStaff,
          canRequestOff:
            weekendMonthlyStatus.actual >= weekendMonthlyReq.requiredPerStaff &&
            weekendYearlyStatus !== 'behind',
        },
        yearly: {
          cumulativeActual: weekendYearlyActual,
          cumulativeRequired: weekendYearlyCum.cumulativeRequired,
          diff: weekendYearlyDiff,
          status: weekendYearlyStatus,
          canRequestOff: weekendYearlyStatus !== 'behind',
        },
      },
    };
  }
}

// 싱글톤 인스턴스 export
export const fairnessValidationService = new FairnessValidationService();
