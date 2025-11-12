'use client'

import { useState, useEffect } from 'react'
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
import { DayButton } from 'react-day-picker'

export type LeaveType = 'ANNUAL' | 'OFF'

interface CategorySlot {
  required: number
  available: number
  approved: number
  onHold: number
}

interface DateSlotInfo {
  date: string
  categorySlots?: {
    [categoryName: string]: CategorySlot
  }
  totalAvailable?: number
}

interface DateSelectorProps {
  selections: Map<string, LeaveType>
  onDateSelection: (date: Date, type: LeaveType) => void
  categoryName?: string
  availableDates?: Date[]
  holidayDates?: string[]
  token: string  // API 호출을 위한 토큰
  startDate?: Date  // 신청 가능 시작일
  endDate?: Date    // 신청 가능 종료일
}

export function DateSelector({
  selections,
  onDateSelection,
  categoryName,
  availableDates,
  holidayDates = [],
  token,
  startDate,
  endDate,
}: DateSelectorProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState<Date | undefined>()
  const [dateSlots, setDateSlots] = useState<Map<string, DateSlotInfo>>(new Map())
  const [loading, setLoading] = useState(false)

  // 슬롯 정보 가져오기
  useEffect(() => {
    const fetchSlots = async () => {
      // 날짜 범위 결정: startDate/endDate 또는 availableDates에서 계산
      let rangeStart: Date
      let rangeEnd: Date

      if (startDate && endDate) {
        rangeStart = startDate
        rangeEnd = endDate
      } else if (availableDates && availableDates.length > 0) {
        const dates = availableDates.map(d => new Date(d))
        rangeStart = new Date(Math.min(...dates.map(d => d.getTime())))
        rangeEnd = new Date(Math.max(...dates.map(d => d.getTime())))
      } else {
        // 날짜 정보가 없으면 API 호출하지 않음
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `/api/leave-apply/${token}/slots?startDate=${formatDate(rangeStart)}&endDate=${formatDate(rangeEnd)}`
        )

        if (!response.ok) {
          throw new Error('슬롯 정보를 가져오지 못했습니다')
        }

        const data = await response.json()

        if (data.success && data.status) {
          const slotsMap = new Map<string, DateSlotInfo>()
          data.status.forEach((slot: DateSlotInfo) => {
            slotsMap.set(slot.date, slot)
          })
          console.log('📅 슬롯 정보 로드:', {
            totalDates: data.status.length,
            categoryName,
            firstSlot: data.status[0],
            categorySlots: data.status[0]?.categorySlots
          })
          setDateSlots(slotsMap)
        } else {
          console.error('❌ 슬롯 정보 로드 실패:', data)
        }
      } catch (error) {
        console.error('슬롯 정보 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSlots()
  }, [availableDates, token, startDate, endDate])

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
      return <Badge variant="default" className="text-[10px] px-1.5 py-0.5 bg-blue-600 font-semibold">{label}</Badge>
    }

    // 공휴일 표시
    if (holidayDates.includes(dateStr)) {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-semibold">공휴일</Badge>
    }

    if (isSunday(date)) {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-semibold">휴무</Badge>
    }

    // 슬롯 정보 표시
    if (categoryName) {
      const slotInfo = dateSlots.get(dateStr)

      // 디버깅
      if (dateStr === formatDate(new Date('2025-11-03'))) {
        console.log('🔍 Badge 체크 (11/3):', {
          dateStr,
          categoryName,
          hasSlotInfo: !!slotInfo,
          categorySlots: slotInfo?.categorySlots,
          categorySlotKeys: slotInfo?.categorySlots ? Object.keys(slotInfo.categorySlots) : [],
          hasCategorySlot: slotInfo?.categorySlots?.[categoryName]
        })
      }

      if (slotInfo?.categorySlots?.[categoryName]) {
        const categorySlot = slotInfo.categorySlots[categoryName]
        const remaining = categorySlot.available // 남은 신청 가능 슬롯
        const totalSlots = categorySlot.available + categorySlot.approved // 총 신청 가능 슬롯

        if (remaining === 0) {
          return <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-semibold">마감</Badge>
        }

        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-bold border-green-500 text-green-700 bg-green-50">
            {remaining}/{totalSlots}
          </Badge>
        )
      }
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

  // 커스텀 Day 컴포넌트
  const CustomDay = (props: React.ComponentProps<typeof DayButton>) => {
    const { day, modifiers, ...rest } = props
    const badge = getDateBadge(day.date)
    const dateStr = formatDate(day.date)

    return (
      <button
        {...rest}
        className={`
          relative flex flex-col items-center justify-center gap-1 w-full h-full py-2
          rounded-md hover:bg-gray-100 transition-colors
          ${modifiers.selected ? 'bg-blue-100 font-bold' : ''}
          ${modifiers.disabled ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
          ${modifiers.unavailable ? 'line-through' : ''}
        `}
        disabled={modifiers.disabled}
      >
        <div className="text-sm font-medium">{day.date.getDate()}</div>
        {badge && (
          <div className="mt-0.5">
            {badge}
          </div>
        )}
      </button>
    )
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
              className="rounded-md border [--cell-size:4rem] w-full"
              modifiers={{
                unavailable: (date) => !isDateAvailable(date),
                selected: (date) => selections.has(formatDate(date)),
              }}
              modifiersClassNames={{
                unavailable: 'text-gray-300 line-through',
                selected: 'bg-blue-100 font-bold',
              }}
              components={{
                DayButton: CustomDay
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
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-bold border-green-500 text-green-700 bg-green-50">2/3</Badge>
          <span className="text-gray-600">
            {categoryName
              ? `${categoryName}(잔여/총슬롯)`
              : '신청 가능 (잔여/총슬롯)'}
          </span>
        </div>
      </div>
    </Card>
  )
}
