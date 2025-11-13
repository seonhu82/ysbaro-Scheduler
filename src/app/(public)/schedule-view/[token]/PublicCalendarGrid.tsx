'use client'

import { getCalendarGridDates, isInMonth, formatDate } from '@/lib/date-utils'
import { PublicCalendarCell } from './PublicCalendarCell'

interface StaffAssignment {
  staff: {
    id: string
    name: string
    rank: string
  }
  hasNightShift: boolean
  leaveType?: 'ANNUAL' | 'OFF' | null
  leaveStatus?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | null
}

interface PublicDaySchedule {
  isHoliday: boolean
  holidayName?: string | null
  assignments: StaffAssignment[]
  combinationName?: string
  requiredStaff?: number
}

interface ScheduleData {
  [date: string]: PublicDaySchedule
}

interface PublicCalendarGridProps {
  year: number
  month: number
  scheduleData?: ScheduleData
  viewMode: 'personal' | 'all'
  authenticatedStaffId?: string | null
  onDateClick?: (date: Date, schedule?: PublicDaySchedule) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function PublicCalendarGrid({
  year,
  month,
  scheduleData = {},
  viewMode,
  authenticatedStaffId,
  onDateClick,
}: PublicCalendarGridProps) {
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
            <PublicCalendarCell
              key={index}
              date={date}
              isCurrentMonth={isCurrentMonthDate}
              schedule={schedule}
              viewMode={viewMode}
              authenticatedStaffId={authenticatedStaffId}
              onClick={onDateClick && schedule ? () => onDateClick(date, schedule) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
