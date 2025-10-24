/**
 * 날짜 유형 분류 서비스
 *
 * 목적: 날짜가 어떤 형평성 카테고리에 속하는지 판단
 * - 하나의 날짜가 여러 카테고리에 중복으로 속할 수 있음
 * - 공휴일과 붙어있는 일요일은 공휴일로 간주
 */

import { addDays, startOfDay } from 'date-fns';

export type FairnessType =
  | 'NIGHT_WEEKDAY'       // 야간 근무 (평일)
  | 'WEEKEND'             // 주말 (토요일)
  | 'HOLIDAY'             // 공휴일
  | 'HOLIDAY_ADJACENT'    // 공휴일 전후
  | 'SUNDAY'              // 일요일 (형평성 제외)
  | 'NORMAL_WEEKDAY';     // 일반 평일 (형평성 제외)

export interface DateTypeResult {
  types: FairnessType[];
  requiresFairnessCheck: boolean;
}

export class DateTypeClassifier {
  /**
   * 특정 날짜가 공휴일인지 확인
   */
  private isHoliday(date: Date, holidays: Date[]): boolean {
    const dateStr = startOfDay(date).toISOString();
    return holidays.some(h => startOfDay(h).toISOString() === dateStr);
  }

  /**
   * 날짜 유형 분류 (중복 가능)
   *
   * @param date 판단할 날짜
   * @param holidays 공휴일 목록
   * @param hasNightShift 해당 날짜에 야간 진료가 있는지
   * @param enableHolidayAdjacentFairness 공휴일 전후 형평성 사용 여부
   * @returns 날짜 유형 배열 (중복 가능)
   */
  getDateTypes(
    date: Date,
    holidays: Date[],
    hasNightShift: boolean,
    enableHolidayAdjacentFairness: boolean
  ): DateTypeResult {
    const types: FairnessType[] = [];
    const dayOfWeek = date.getDay(); // 0=일, 1=월, ..., 6=토

    // 1. 공휴일 체크
    if (this.isHoliday(date, holidays)) {
      types.push('HOLIDAY');
      return {
        types,
        requiresFairnessCheck: true
      };
    }

    // 2. 일요일 체크
    if (dayOfWeek === 0) {
      // 전날 또는 다음날이 공휴일이면 공휴일로 간주
      const prevDay = addDays(date, -1);
      const nextDay = addDays(date, 1);

      if (this.isHoliday(prevDay, holidays) || this.isHoliday(nextDay, holidays)) {
        types.push('HOLIDAY');
        return {
          types,
          requiresFairnessCheck: true
        };
      }

      // 단독 일요일 - 형평성 제외
      types.push('SUNDAY');
      return {
        types,
        requiresFairnessCheck: false
      };
    }

    // 3. 토요일은 주말로 카운트
    if (dayOfWeek === 6) {
      types.push('WEEKEND');
    }

    // 4. 공휴일 전후 체크 (설정 활성화 시)
    if (enableHolidayAdjacentFairness) {
      const prevDay = addDays(date, -1);
      const nextDay = addDays(date, 1);

      if (this.isHoliday(prevDay, holidays) || this.isHoliday(nextDay, holidays)) {
        types.push('HOLIDAY_ADJACENT');
      }
    }

    // 5. 야간 평일 체크 (월~금만)
    if (hasNightShift && dayOfWeek >= 1 && dayOfWeek <= 5) {
      types.push('NIGHT_WEEKDAY');
    }

    // 6. 아무것도 없으면 일반 평일
    if (types.length === 0) {
      types.push('NORMAL_WEEKDAY');
      return {
        types,
        requiresFairnessCheck: false
      };
    }

    return {
      types,
      requiresFairnessCheck: true
    };
  }

  /**
   * 형평성 체크가 필요한지 판단
   */
  requiresFairnessCheck(date: Date, holidays: Date[], hasNightShift: boolean, enableHolidayAdjacentFairness: boolean): boolean {
    const result = this.getDateTypes(date, holidays, hasNightShift, enableHolidayAdjacentFairness);
    return result.requiresFairnessCheck;
  }

  /**
   * 특정 형평성 타입에 속하는지 확인
   */
  hasType(date: Date, holidays: Date[], hasNightShift: boolean, enableHolidayAdjacentFairness: boolean, targetType: FairnessType): boolean {
    const result = this.getDateTypes(date, holidays, hasNightShift, enableHolidayAdjacentFairness);
    return result.types.includes(targetType);
  }
}

// 싱글톤 인스턴스 export
export const dateTypeClassifier = new DateTypeClassifier();
