'use client'

import { isToday, isWeekend, isSunday } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

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
  // 전체 보기용
  combinationName?: string
  requiredStaff?: number
}

interface PublicCalendarCellProps {
  date: Date
  isCurrentMonth: boolean
  schedule?: PublicDaySchedule
  viewMode: 'personal' | 'all'
  authenticatedStaffId?: string | null
  onClick?: () => void
}

export function PublicCalendarCell({
  date,
  isCurrentMonth,
  schedule,
  viewMode,
  authenticatedStaffId,
  onClick,
}: PublicCalendarCellProps) {
  const today = isToday(date)
  const weekend = isWeekend(date)
  const sunday = isSunday(date)

  // 내 배정만 필터링 (personal 모드)
  const myAssignments = viewMode === 'personal' && authenticatedStaffId && schedule
    ? schedule.assignments.filter(a => a.staff.id === authenticatedStaffId)
    : []

  // 야간 근무 여부
  const hasNightShift = schedule?.assignments.some(a => a.hasNightShift) || false

  // Personal View: 내 근무/연차/오프만 표시
  const renderPersonalView = () => {
    // 공휴일이면 공휴일 이름 표시
    if (schedule?.holidayName) {
      return (
        <div className="flex items-center gap-1">
          <span className={cn(
            "inline-block px-2 py-0.5 text-xs font-medium rounded",
            isCurrentMonth ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-600"
          )}>
            {schedule.holidayName}
          </span>
        </div>
      )
    }

    if (!schedule || myAssignments.length === 0) {
      return <p className="text-xs text-gray-400 mt-2">-</p>
    }

    return (
      <div className="space-y-1">
        {myAssignments.map((assignment, idx) => {
          if (assignment.leaveType === 'ANNUAL') {
            return (
              <div key={idx} className="flex items-center gap-1">
                <span className={cn(
                  "inline-block px-2 py-0.5 text-xs font-medium rounded",
                  isCurrentMonth ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                )}>
                  연차
                </span>
                {assignment.hasNightShift && <span className="text-sm" title="야간">🌙</span>}
              </div>
            )
          } else if (assignment.leaveType === 'OFF') {
            return (
              <div key={idx} className="flex items-center gap-1">
                <span className={cn(
                  "inline-block px-2 py-0.5 text-xs font-medium rounded",
                  isCurrentMonth ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"
                )}>
                  오프
                </span>
                {assignment.hasNightShift && <span className="text-sm" title="야간">🌙</span>}
              </div>
            )
          } else {
            return (
              <div key={idx} className="flex items-center gap-1">
                <span className={cn(
                  "inline-block px-2 py-0.5 text-xs font-medium rounded",
                  isCurrentMonth ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                )}>
                  근무
                </span>
                {assignment.hasNightShift && <span className="text-sm" title="야간">🌙</span>}
              </div>
            )
          }
        })}
      </div>
    )
  }

  // All View: 원장 패턴 + 근무 인원
  const renderAllView = () => {
    if (!schedule) return null

    // 공휴일이면 공휴일 이름만 표시
    if (schedule.holidayName) {
      return (
        <div className="flex items-center gap-1">
          <span className={cn(
            "inline-block px-2 py-0.5 text-xs font-medium rounded",
            isCurrentMonth ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-600"
          )}>
            {schedule.holidayName}
          </span>
        </div>
      )
    }

    // 근무 배정 수 (연차/오프 제외)
    const workAssignments = schedule.assignments.filter(a => !a.leaveType)
    const annualLeaveCount = schedule.assignments.filter(a => a.leaveType === 'ANNUAL').length
    const offCount = schedule.assignments.filter(a => a.leaveType === 'OFF').length

    // 조합명이나 근무자가 없으면 표시 안함
    if (!schedule.combinationName && workAssignments.length === 0 && annualLeaveCount === 0 && offCount === 0) {
      return <p className="text-xs text-gray-400 mt-2">-</p>
    }

    return (
      <div className="space-y-1.5">
        {/* 조합명 + 야간 */}
        {schedule.combinationName && (
          <div className="flex items-center gap-1">
            <span className={cn(
              "inline-block px-2 py-0.5 text-xs font-medium rounded",
              isCurrentMonth ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
            )}>
              {schedule.combinationName}
            </span>
            {hasNightShift && (
              <span className="text-sm" title="야간">🌙</span>
            )}
          </div>
        )}

        {/* 배치 인원 */}
        {workAssignments.length > 0 && (
          <div className="text-xs">
            <span className={cn(
              'font-medium',
              isCurrentMonth ? 'text-green-600' : 'text-gray-500'
            )}>
              근무 {workAssignments.length}명
            </span>
          </div>
        )}

        {/* 연차/오프 */}
        <div className="flex gap-2 text-xs">
          {annualLeaveCount > 0 && (
            <span className={cn(
              "px-1.5 py-0.5 rounded font-medium",
              isCurrentMonth ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
            )}>
              연차 {annualLeaveCount}
            </span>
          )}
          {offCount > 0 && (
            <span className={cn(
              "px-1.5 py-0.5 rounded font-medium",
              isCurrentMonth ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"
            )}>
              오프 {offCount}
            </span>
          )}
        </div>
      </div>
    )
  }

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
            schedule?.holidayName && 'text-red-600 font-bold',
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
          {viewMode === 'personal' ? renderPersonalView() : renderAllView()}
        </div>
      )}
    </div>
  )
}
