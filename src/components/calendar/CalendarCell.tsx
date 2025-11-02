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
}

interface CalendarCellProps {
  date: Date
  isCurrentMonth: boolean
  schedule?: DaySchedule
  onClick?: () => void
}

export function CalendarCell({
  date,
  isCurrentMonth,
  schedule,
  onClick,
}: CalendarCellProps) {
  const today = isToday(date)
  const weekend = isWeekend(date)
  const sunday = isSunday(date)

  return (
    <div
      onClick={onClick}
      className={cn(
        'min-h-[120px] p-2 border border-gray-200 cursor-pointer transition-colors',
        'hover:bg-gray-50',
        !isCurrentMonth && 'bg-gray-50/50 text-gray-400',
        today && 'bg-blue-50 border-blue-300',
        weekend && 'bg-gray-50',
        onClick && 'cursor-pointer'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'text-sm font-medium',
            today && 'text-blue-600 font-bold',
            sunday && !today && 'text-red-600',
            !isCurrentMonth && 'text-gray-400'
          )}
        >
          {date.getDate()}
        </span>
      </div>

      {isCurrentMonth && schedule && (
        <div className="space-y-1.5">
          {/* 조합명 + 야간 이모지 */}
          <div className="flex items-center gap-1">
            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              {schedule.combinationName}
            </span>
            {schedule.hasNightShift && (
              <span className="text-sm" title="야간">🌙</span>
            )}
          </div>

          {/* 배치인력 / 필요인력 */}
          <div className="text-xs">
            <span className={cn(
              'font-medium',
              schedule.assignedStaff >= schedule.requiredStaff ? 'text-green-600' : 'text-amber-600'
            )}>
              {schedule.assignedStaff}
            </span>
            <span className="text-gray-500"> / {schedule.requiredStaff}</span>
          </div>

          {/* 연차/오프 */}
          <div className="flex gap-2 text-xs">
            {(schedule.annualLeaveCount ?? 0) > 0 && (
              <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                연차 {schedule.annualLeaveCount}
              </span>
            )}
            {(schedule.offCount ?? 0) > 0 && (
              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                오프 {schedule.offCount}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
