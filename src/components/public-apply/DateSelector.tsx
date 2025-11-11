'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { isSunday, formatDate } from '@/lib/date-utils'
import { ko } from 'date-fns/locale'

export type LeaveType = 'ANNUAL' | 'OFF'

interface CategorySlot {
  required: number
  available: number
  approved: number
  onHold: number
}

interface DateSelectorProps {
  selections: Map<string, LeaveType>
  onDateSelection: (date: Date, type: LeaveType) => void
  categoryName?: string
  availableDates?: Date[]
  holidayDates?: string[]
}

export function DateSelector({
  selections,
  onDateSelection,
  categoryName,
  availableDates,
  holidayDates = [],
}: DateSelectorProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState<Date | undefined>()

  const isDateAvailable = (date: Date) => {
    const dateStr = formatDate(date)

    // 공휴일이면 비활성화
    if (holidayDates.includes(dateStr)) {
      return false
    }

    // 일요일이면 비활성화
    if (isSunday(date)) {
      return false
    }

    // 과거 날짜는 비활성화
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (date < today) {
      return false
    }

    // availableDates가 제공된 경우, 해당 날짜만 허용
    if (availableDates && availableDates.length > 0) {
      return availableDates.some(d => formatDate(d) === dateStr)
    }

    return true
  }

  const getDateBadge = (date: Date) => {
    const dateStr = formatDate(date)

    // 선택된 날짜인지 확인
    const selection = selections.get(dateStr)
    if (selection) {
      const label = selection === 'ANNUAL' ? '연차' : '오프'
      return <Badge variant="default" className="text-xs bg-blue-600">{label}</Badge>
    }

    // 공휴일 표시
    if (holidayDates.includes(dateStr)) {
      return <Badge variant="destructive" className="text-xs">공휴일</Badge>
    }

    if (isSunday(date)) {
      return <Badge variant="destructive" className="text-xs">휴무</Badge>
    }

    return null
  }

  const handleDateClick = (date: Date | undefined) => {
    if (!date) return

    // 사용 불가능한 날짜는 무시
    if (!isDateAvailable(date)) return

    setCurrentDate(date)
    setPopoverOpen(true)
  }

  const handleTypeSelect = (type: LeaveType) => {
    if (currentDate) {
      onDateSelection(currentDate, type)
      setPopoverOpen(false)
      setCurrentDate(undefined)
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">날짜 선택</h3>
        <p className="text-sm text-gray-600">
          신청할 날짜를 클릭하여 연차 또는 오프를 선택해주세요.
        </p>
      </div>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <div>
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={handleDateClick}
              locale={ko}
              disabled={(date) => !isDateAvailable(date)}
              className="rounded-md border"
              modifiers={{
                unavailable: (date) => !isDateAvailable(date),
                selected: (date) => selections.has(formatDate(date)),
              }}
              modifiersClassNames={{
                unavailable: 'text-gray-300 line-through',
                selected: 'bg-blue-100 font-bold',
              }}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium mb-3">
              {currentDate && formatDate(currentDate)} - 신청 유형 선택
            </p>
            <Button
              onClick={() => handleTypeSelect('ANNUAL')}
              className="w-full"
              variant="default"
            >
              연차
            </Button>
            <Button
              onClick={() => handleTypeSelect('OFF')}
              className="w-full"
              variant="outline"
            >
              오프
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="default" className="bg-blue-600">연차</Badge>
          <span className="text-gray-600">선택된 연차</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="default" className="bg-blue-600">오프</Badge>
          <span className="text-gray-600">선택된 오프</span>
        </div>
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
          <span className="text-gray-600">
            {categoryName
              ? `${categoryName} 구분 (잔여/필요)`
              : '신청 가능 (잔여/전체)'}
          </span>
        </div>
      </div>
    </Card>
  )
}
