'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

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

interface StaffListPopupProps {
  isOpen: boolean
  onClose: () => void
  date: Date | null
  assignments: StaffAssignment[]
  isHoliday?: boolean
  holidayName?: string | null
}

export function StaffListPopup({
  isOpen,
  onClose,
  date,
  assignments,
  isHoliday,
  holidayName,
}: StaffListPopupProps) {
  if (!date) return null

  const dateStr = date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  // 근무자만 표시 (연차/오프 모두 제외)
  const workStaff = assignments.filter(a => !a.leaveType)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dateStr}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isHoliday && holidayName && (
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <Badge variant="destructive" className="text-base">
                {holidayName}
              </Badge>
            </div>
          )}

          {/* 근무자 */}
          {workStaff.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-gray-700">
                근무자 ({workStaff.length}명)
              </h3>
              <div className="space-y-2">
                {workStaff.map((assignment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-blue-50 rounded"
                  >
                    <div>
                      <span className="font-medium">{assignment.staff.name}</span>
                      <span className="text-xs text-gray-600 ml-2">
                        {assignment.staff.rank}
                      </span>
                    </div>
                    {assignment.hasNightShift && (
                      <Badge variant="outline" className="bg-purple-100">
                        🌙 야간
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {workStaff.length === 0 && !isHoliday && (
            <p className="text-center text-gray-500 py-4">배정된 직원이 없습니다</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
