/**
 * 형평성 기반 오프 신청 검증 로직
 *
 * 기능:
 * - 야간/주말/공휴일 근무 형평성 체크
 * - 오프 신청 가능 여부 판단
 * - 실시간 검증 및 안내 메시지 생성
 */

import { prisma } from '@/lib/prisma';

// ============================================
// 타입 정의
// ============================================

export enum DateType {
  NORMAL_WEEKDAY = 'NORMAL_WEEKDAY',    // 일반 평일 (야간 없음)
  NIGHT_WEEKDAY = 'NIGHT_WEEKDAY',      // 야간 평일
  WEEKEND = 'WEEKEND',                   // 주말 (토요일)
  HOLIDAY = 'HOLIDAY',                   // 공휴일
  SUNDAY = 'SUNDAY'                      // 일요일 (전원 휴무)
}

export interface FairnessValidationResult {
  allowed: boolean;
  requiresFairnessCheck: boolean;
  reason?: string;
  message?: string;
  details?: {
    myScore: number;
    averageScore: number;
    minRequired?: number;
    nightShiftCount: number;
    weekendCount: number;
    holidayCount: number;
    status?: 'LOW' | 'NORMAL' | 'HIGH';
  };
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  message?: string;
}

// ============================================
// 날짜 유형 판단
// ============================================

/**
 * 날짜 유형 판단
 */
export async function getDateType(
  date: Date,
  clinicId: string
): Promise<DateType> {
  const dayOfWeek = date.getDay();

  // 일요일
  if (dayOfWeek === 0) {
    return DateType.SUNDAY;
  }

  // 공휴일 체크
  const holiday = await prisma.holiday.findFirst({
    where: {
      clinicId,
      date: {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999))
      }
    }
  });

  if (holiday) {
    return DateType.HOLIDAY;
  }

  // 토요일
  if (dayOfWeek === 6) {
    return DateType.WEEKEND;
  }

  // 평일 - 야간 여부 확인
  // TODO: DailySlot에서 해당 날짜의 원장 스케줄 확인
  // 임시로 원장 스케줄이 있고 야간이 있는지 체크
  // 실제 구현 시 DailySlot 테이블 참조
  const hasNightShift = await checkNightShiftSchedule(date, clinicId);

  if (hasNightShift) {
    return DateType.NIGHT_WEEKDAY;
  }

  return DateType.NORMAL_WEEKDAY;
}

/**
 * 야간 근무 스케줄 확인 (임시)
 */
async function checkNightShiftSchedule(
  date: Date,
  clinicId: string
): Promise<boolean> {
  // TODO: DailySlot 테이블에서 확인
  // 현재는 임시로 false 반환
  return false;
}

/**
 * 날짜 유형 한글 변환
 */
export function dateTypeToKorean(dateType: DateType): string {
  switch (dateType) {
    case DateType.NORMAL_WEEKDAY:
      return '평일';
    case DateType.NIGHT_WEEKDAY:
      return '야간';
    case DateType.WEEKEND:
      return '주말';
    case DateType.HOLIDAY:
      return '공휴일';
    case DateType.SUNDAY:
      return '일요일';
    default:
      return '알 수 없음';
  }
}

// ============================================
// 형평성 점수 조회 및 계산
// ============================================

/**
 * 직원의 이번 달 형평성 점수 조회
 */
export async function getFairnessScore(
  staffId: string,
  year: number,
  month: number
) {
  let score = await prisma.fairnessScore.findUnique({
    where: {
      staffId_year_month: {
        staffId,
        year,
        month
      }
    }
  });

  // 없으면 기본값 생성
  if (!score) {
    score = await prisma.fairnessScore.create({
      data: {
        staffId,
        year,
        month,
        nightShiftCount: 0,
        weekendCount: 0,
        holidayCount: 0,
        totalScore: 0
      }
    });
  }

  return score;
}

/**
 * 전체 직원 평균 점수 계산
 */
export async function getAverageFairnessScore(
  clinicId: string,
  year: number,
  month: number
): Promise<number> {
  // 해당 병원의 모든 활성 직원
  const activeStaff = await prisma.staff.findMany({
    where: {
      clinicId,
      isActive: true
    },
    select: { id: true }
  });

  if (activeStaff.length === 0) return 0;

  // 모든 직원의 점수 조회
  const scores = await prisma.fairnessScore.findMany({
    where: {
      staffId: {
        in: activeStaff.map(s => s.id)
      },
      year,
      month
    }
  });

  // 점수가 없는 직원은 0점으로 간주
  const totalScore = scores.reduce((sum, s) => sum + s.totalScore, 0);

  return totalScore / activeStaff.length;
}

/**
 * 형평성 설정 조회
 */
export async function getFairnessSettings(clinicId: string) {
  let settings = await prisma.fairnessSettings.findUnique({
    where: { clinicId }
  });

  // 없으면 기본값 생성
  if (!settings) {
    settings = await prisma.fairnessSettings.create({
      data: {
        clinicId,
        nightShiftWeight: 2.0,
        weekendWeight: 1.5,
        holidayWeight: 2.0,
        enableFairnessCheck: true,
        fairnessThreshold: 0.2
      }
    });
  }

  return settings;
}

// ============================================
// 기본 검증 로직
// ============================================

/**
 * 기본 검증 (연차 잔여, 중복 신청, 슬롯 여유)
 */
export async function validateBasic(
  staffId: string,
  date: Date,
  leaveType: 'ANNUAL' | 'OFF',
  linkId: string
): Promise<ValidationResult> {

  // 1. 연차 잔여 확인 (연차만)
  if (leaveType === 'ANNUAL') {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        totalAnnualDays: true,
        usedAnnualDays: true
      }
    });

    if (!staff) {
      return {
        allowed: false,
        reason: 'STAFF_NOT_FOUND',
        message: '직원 정보를 찾을 수 없습니다.'
      };
    }

    const remaining = staff.totalAnnualDays - staff.usedAnnualDays;
    if (remaining <= 0) {
      return {
        allowed: false,
        reason: 'NO_ANNUAL_LEFT',
        message: '사용 가능한 연차가 없습니다.'
      };
    }
  }

  // 2. 중복 신청 확인
  const existing = await prisma.leaveApplication.findFirst({
    where: {
      staffId,
      date: {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999))
      }
    }
  });

  if (existing) {
    return {
      allowed: false,
      reason: 'DUPLICATE',
      message: '이미 해당 날짜에 신청하셨습니다.'
    };
  }

  // 3. 슬롯 여유 확인
  // TODO: WeekInfo/DailySlot 테이블에서 확인
  // 현재는 임시로 통과
  const slotAvailable = true;

  if (!slotAvailable) {
    return {
      allowed: false,
      reason: 'NO_SLOT',
      message: '해당 날짜는 신청 가능 인원이 마감되었습니다.'
    };
  }

  return { allowed: true };
}

// ============================================
// 형평성 검증 로직
// ============================================

/**
 * 형평성 기반 오프 신청 검증
 */
export async function validateFairness(
  staffId: string,
  date: Date,
  clinicId: string
): Promise<FairnessValidationResult> {

  // 1. 날짜 유형 판단
  const dateType = await getDateType(date, clinicId);

  // 일반 평일 또는 일요일은 형평성 체크 불필요
  if (dateType === DateType.NORMAL_WEEKDAY || dateType === DateType.SUNDAY) {
    return {
      allowed: true,
      requiresFairnessCheck: false
    };
  }

  // 2. 형평성 설정 확인
  const settings = await getFairnessSettings(clinicId);

  if (!settings.enableFairnessCheck) {
    return {
      allowed: true,
      requiresFairnessCheck: false
    };
  }

  // 3. 이번 달 점수 조회
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth() + 1;

  const myScore = await getFairnessScore(staffId, currentYear, currentMonth);
  const averageScore = await getAverageFairnessScore(clinicId, currentYear, currentMonth);

  // 4. 최소 점수 기준 계산
  const minRequired = averageScore * (1 - settings.fairnessThreshold);

  // 5. 판단
  if (myScore.totalScore < minRequired) {
    return {
      allowed: false,
      requiresFairnessCheck: true,
      reason: 'FAIRNESS_SCORE_LOW',
      message: `이번 달 ${dateTypeToKorean(dateType)} 근무가 부족하여 해당 날짜 오프를 신청할 수 없습니다.`,
      details: {
        myScore: myScore.totalScore,
        averageScore: averageScore,
        minRequired: minRequired,
        nightShiftCount: myScore.nightShiftCount,
        weekendCount: myScore.weekendCount,
        holidayCount: myScore.holidayCount,
        status: 'LOW'
      }
    };
  }

  // 6. 신청 가능 - 점수 상태 표시
  const status = myScore.totalScore >= averageScore * (1 + settings.fairnessThreshold)
    ? 'HIGH'
    : 'NORMAL';

  return {
    allowed: true,
    requiresFairnessCheck: true,
    details: {
      myScore: myScore.totalScore,
      averageScore: averageScore,
      nightShiftCount: myScore.nightShiftCount,
      weekendCount: myScore.weekendCount,
      holidayCount: myScore.holidayCount,
      status
    }
  };
}

// ============================================
// 통합 검증 함수
// ============================================

/**
 * 전체 검증 (기본 + 형평성)
 */
export async function validateLeaveApplication(
  staffId: string,
  date: Date,
  leaveType: 'ANNUAL' | 'OFF',
  linkId: string,
  clinicId: string
): Promise<{
  allowed: boolean;
  basicValidation: ValidationResult;
  fairnessValidation?: FairnessValidationResult;
}> {

  // 1. 기본 검증
  const basicValidation = await validateBasic(staffId, date, leaveType, linkId);

  if (!basicValidation.allowed) {
    return {
      allowed: false,
      basicValidation
    };
  }

  // 2. 오프인 경우만 형평성 검증
  if (leaveType === 'OFF') {
    const fairnessValidation = await validateFairness(staffId, date, clinicId);

    return {
      allowed: fairnessValidation.allowed,
      basicValidation,
      fairnessValidation
    };
  }

  // 3. 연차는 형평성 체크 없이 통과
  return {
    allowed: true,
    basicValidation
  };
}

// ============================================
// 형평성 점수 업데이트 (스케줄 확정 시)
// ============================================

/**
 * 스케줄 확정 시 형평성 점수 자동 업데이트
 */
export async function updateFairnessScoresFromSchedule(
  clinicId: string,
  year: number,
  month: number
) {
  // 1. 해당 월의 스케줄 조회
  const schedule = await prisma.schedule.findUnique({
    where: {
      clinicId_year_month: {
        clinicId,
        year,
        month
      }
    },
    include: {
      staffAssignments: {
        include: {
          staff: true
        }
      }
    }
  });

  if (!schedule) {
    throw new Error('스케줄을 찾을 수 없습니다.');
  }

  // 2. 형평성 설정 조회
  const settings = await getFairnessSettings(clinicId);

  // 3. 직원별 집계
  const staffScores = new Map<string, {
    nightShiftCount: number;
    weekendCount: number;
    holidayCount: number;
  }>();

  // 모든 직원 초기화
  const allStaff = await prisma.staff.findMany({
    where: { clinicId, isActive: true },
    select: { id: true }
  });

  allStaff.forEach(staff => {
    staffScores.set(staff.id, {
      nightShiftCount: 0,
      weekendCount: 0,
      holidayCount: 0
    });
  });

  // 4. 배정 내역 분석
  for (const assignment of schedule.staffAssignments) {
    const date = new Date(assignment.date);
    const staffId = assignment.staffId;

    const score = staffScores.get(staffId);
    if (!score) continue;

    // 날짜 유형 판단
    const dateType = await getDateType(date, clinicId);

    // 점수 증가
    switch (dateType) {
      case DateType.NIGHT_WEEKDAY:
        score.nightShiftCount++;
        break;
      case DateType.WEEKEND:
        score.weekendCount++;
        break;
      case DateType.HOLIDAY:
        score.holidayCount++;
        break;
    }
  }

  // 5. DB 저장
  for (const [staffId, counts] of staffScores.entries()) {
    const totalScore =
      (counts.nightShiftCount * settings.nightShiftWeight) +
      (counts.weekendCount * settings.weekendWeight) +
      (counts.holidayCount * settings.holidayWeight);

    await prisma.fairnessScore.upsert({
      where: {
        staffId_year_month: {
          staffId,
          year,
          month
        }
      },
      create: {
        staffId,
        year,
        month,
        nightShiftCount: counts.nightShiftCount,
        weekendCount: counts.weekendCount,
        holidayCount: counts.holidayCount,
        totalScore
      },
      update: {
        nightShiftCount: counts.nightShiftCount,
        weekendCount: counts.weekendCount,
        holidayCount: counts.holidayCount,
        totalScore
      }
    });
  }

  return { success: true, updatedCount: staffScores.size };
}
