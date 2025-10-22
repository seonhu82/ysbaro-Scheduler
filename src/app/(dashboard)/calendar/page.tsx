'use client'

import { useState } from 'react'
import { CalendarView } from '@/components/calendar/CalendarView'
import { formatDateWithDay } from '@/lib/date-utils'

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    // TODO: 날짜 상세 팝업 열기
    console.log('Selected date:', formatDateWithDay(date))
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">캘린더</h1>
        <p className="text-gray-600 mt-2">월간 스케줄을 확인하고 관리합니다</p>
      </div>

      <CalendarView onDateClick={handleDateClick} />

      {selectedDate && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-700">
            <span className="font-medium">선택된 날짜:</span> {formatDateWithDay(selectedDate)}
          </p>
        </div>
      )}
    </div>
  )
}
