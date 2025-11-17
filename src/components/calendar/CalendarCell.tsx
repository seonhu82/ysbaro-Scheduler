'use client'

import { isToday, isWeekend, isSunday } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

interface DaySchedule {
  combinationName: string
  hasNightShift: boolean
  requiredStaff: number
  assignedStaff: number
  doctorShortNames: string[]
  annualLeaveCount?: number // 연차 인원
  offCount?: number // 오프 인원
  leaveCount?: number // 하위 호환용 (연차+오프 합계)
  holidayName?: string | null // 공휴일명
}

interface CalendarCellProps {
  date: Date
  isCurrentMonth: boolean
  schedule?: DaySchedule
  onClick?: () => void
  filterType?: 'all' | 'auto' | 'manual'
}

export function CalendarCell({
  date,
  isCurrentMonth,
  schedule,
  onClick,
  filterType = 'all',
}: CalendarCellProps) {
  const today = isToday(date)
  const weekend = isWeekend(date)
  const sunday = isSunday(date)

  return (
    <div
      onClick={onClick}
      className={cn(
        'min-h-[120px] p-2 border border-gray-200 transition-colors',
        onClick && 'cursor-pointer hover:bg-gray-50',
        !isCurrentMonth && 'bg-gray-50/50 text-gray-400',
        today && 'bg-blue-50 border-blue-300',
        weekend && 'bg-gray-50'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'text-sm font-medium',
            today && 'text-blue-600 font-bold',
            schedule?.holidayName && 'text-red-600 font-bold', // 공휴일 날짜도 빨간색
            sunday && !today && !schedule?.holidayName && 'text-red-600',
            !isCurrentMonth && 'text-gray-400'
          )}
        >
          {date.getDate()}
        </span>
      </div>

      {schedule && (
        <div className={cn(
          "space-y-1.5",
          !isCurrentMonth && "opacity-60"
        )}>
          {schedule.holidayName ? (
            // 공휴일일 때는 공휴일명만 표시 (빨간색 계열)
            <div className="flex items-center gap-1">
              <span className={cn(
                "inline-block px-2 py-0.5 text-xs font-medium rounded",
                isCurrentMonth ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-600"
              )}>
                {schedule.holidayName}
              </span>
            </div>
          ) : (
            // 일반 날짜일 때는 모든 정보 표시
            <>
              {/* 조합명 + 야간 이모지 */}
              <div className="flex items-center gap-1">
                <span className={cn(
                  "inline-block px-2 py-0.5 text-xs font-medium rounded",
                  isCurrentMonth ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                )}>
                  {schedule.combinationName}
                </span>
                {schedule.hasNightShift && (
                  <span className="text-sm" title="야간">🌙</span>
                )}
              </div>

              {/* 배치인력 / 필요인력 (수동 배치 부서는 필요인력 숨김) */}
              {filterType !== 'manual' && (
                <div className="text-xs">
                  <span className={cn(
                    'font-medium',
                    isCurrentMonth
                      ? (schedule.assignedStaff >= schedule.requiredStaff ? 'text-green-600' : 'text-amber-600')
                      : 'text-gray-500'
                  )}>
                    {schedule.assignedStaff}
                  </span>
                  <span className="text-gray-500"> / {schedule.requiredStaff}</span>
                </div>
              )}
              {filterType === 'manual' && (
                <div className="text-xs">
                  <span className={cn(
                    'font-medium text-gray-700',
                    !isCurrentMonth && 'text-gray-500'
                  )}>
                    배치: {schedule.assignedStaff}명
                  </span>
                </div>
              )}

              {/* 연차/오프 */}
              <div className="flex gap-2 text-xs">
                {(schedule.annualLeaveCount ?? 0) > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded font-medium",
                    isCurrentMonth ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                  )}>
                    연차 {schedule.annualLeaveCount}
                  </span>
                )}
                {(schedule.offCount ?? 0) > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded font-medium",
                    isCurrentMonth ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"
                  )}>
                    오프 {schedule.offCount}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
