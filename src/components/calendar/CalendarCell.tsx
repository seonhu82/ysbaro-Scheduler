'use client'

import { isToday, isWeekend, isSunday } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

interface CalendarCellProps {
  date: Date
  isCurrentMonth: boolean
  doctors?: { id: string; name: string }[]
  staffCount?: number
  onClick?: () => void
}

export function CalendarCell({
  date,
  isCurrentMonth,
  doctors = [],
  staffCount = 0,
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

      {isCurrentMonth && (doctors.length > 0 || staffCount > 0) && (
        <div className="space-y-1">
          {/* 원장 목록 */}
          {doctors.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {doctors.map((doctor) => (
                <span
                  key={doctor.id}
                  className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded"
                >
                  {doctor.name}
                </span>
              ))}
            </div>
          )}

          {/* 직원 수 */}
          {staffCount > 0 && (
            <div className="text-xs text-gray-600">
              직원: {staffCount}명
            </div>
          )}
        </div>
      )}
    </div>
  )
}
