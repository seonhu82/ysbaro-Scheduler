'use client'

import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { isSunday, formatDate } from '@/lib/date-utils'
import { ko } from 'date-fns/locale'

interface SlotStatus {
  date: string
  available: number
  total: number
  isHoliday: boolean
}

interface DateSelectorProps {
  selectedDate: Date | undefined
  onSelect: (date: Date | undefined) => void
  slotStatus: SlotStatus[]
  availableDates?: Date[]
}

export function DateSelector({
  selectedDate,
  onSelect,
  slotStatus,
  availableDates,
}: DateSelectorProps) {
  const isDateAvailable = (date: Date) => {
    const dateStr = formatDate(date)
    const status = slotStatus.find((s) => s.date === dateStr)

    // 휴일이면 비활성화
    if (status?.isHoliday || isSunday(date)) {
      return false
    }

    // 슬롯이 없으면 비활성화
    if (status && status.available === 0) {
      return false
    }

    // 과거 날짜는 비활성화
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) {
      return false
    }

    return true
  }

  const getDateBadge = (date: Date) => {
    const dateStr = formatDate(date)
    const status = slotStatus.find((s) => s.date === dateStr)

    if (!status) return null

    if (status.isHoliday || isSunday(date)) {
      return <Badge variant="destructive" className="text-xs">휴무</Badge>
    }

    if (status.available === 0) {
      return <Badge variant="secondary" className="text-xs">마감</Badge>
    }

    return (
      <Badge variant="outline" className="text-xs">
        {status.available}/{status.total}
      </Badge>
    )
  }

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">날짜 선택</h3>
        <p className="text-sm text-gray-600">
          신청할 날짜를 선택해주세요. 휴무일과 마감된 날짜는 선택할 수 없습니다.
        </p>
      </div>

      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onSelect}
        locale={ko}
        disabled={(date) => !isDateAvailable(date)}
        className="rounded-md border"
        modifiers={{
          unavailable: (date) => !isDateAvailable(date),
        }}
        modifiersClassNames={{
          unavailable: 'text-gray-300 line-through',
        }}
      />

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="destructive">휴무</Badge>
          <span className="text-gray-600">일요일 또는 공휴일</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">마감</Badge>
          <span className="text-gray-600">신청 인원 마감</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">2/3</Badge>
          <span className="text-gray-600">신청 가능 (잔여/전체)</span>
        </div>
      </div>
    </Card>
  )
}
