'use client'

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface MonthNavigatorProps {
  year: number
  month: number
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
}

export function MonthNavigator({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
}: MonthNavigatorProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {year}년 {month}월
        </h2>
        <button
          onClick={onToday}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Calendar className="w-4 h-4" />
          오늘
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onPrevMonth}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="이전 달"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onNextMonth}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="다음 달"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
