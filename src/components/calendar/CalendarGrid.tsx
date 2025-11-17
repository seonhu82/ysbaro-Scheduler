'use client'

import { getCalendarGridDates, isInMonth, formatDate } from '@/lib/date-utils'
import { CalendarCell } from './CalendarCell'

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

interface ScheduleData {
  [date: string]: DaySchedule
}

interface CalendarGridProps {
  year: number
  month: number
  scheduleData?: ScheduleData
  onDateClick?: (date: Date) => void
  filterType?: 'all' | 'auto' | 'manual'
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarGrid({
  year,
  month,
  scheduleData = {},
  onDateClick,
  filterType = 'all',
}: CalendarGridProps) {
  const dates = getCalendarGridDates(year, month)

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={`py-3 text-center text-sm font-semibold ${
              index === 0 ? 'text-red-600' : 'text-gray-700'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {dates.map((date, index) => {
          const dateKey = formatDate(date)
          const schedule = scheduleData[dateKey]
          const isCurrentMonthDate = isInMonth(date, year, month)

          return (
            <CalendarCell
              key={index}
              date={date}
              isCurrentMonth={isCurrentMonthDate}
              schedule={schedule}
              onClick={() => onDateClick?.(date)}
              filterType={filterType}
            />
          )
        })}
      </div>
    </div>
  )
}
