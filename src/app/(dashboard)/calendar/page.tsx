'use client'

import { CalendarView } from '@/components/calendar/CalendarView'

export default function CalendarPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">캘린더</h1>
        <p className="text-gray-600 mt-2">월간 스케줄을 확인하고 관리합니다</p>
      </div>

      <CalendarView />
    </div>
  )
}
