'use client'

import { useState, useEffect } from 'react'
import { MonthNavigator } from './MonthNavigator'
import { CalendarGrid } from './CalendarGrid'
import { DayDetailPopup } from './DayDetailPopup'
// import { PatternApplyButton } from './PatternApplyButton' // 메인 캘린더에서는 미사용

// Updated: Now includes both leave applications and scheduled OFF days

interface Doctor {
  id: string
  name: string
  shortName: string
}

interface DaySchedule {
  combinationName: string
  hasNightShift: boolean
  requiredStaff: number
  assignedStaff: number
  doctorShortNames: string[]
  annualLeaveCount?: number // 연차 인원
  offCount?: number // 오프 인원
  leaveCount?: number // 하위 호환용 (연차+오프 합계)
  holidayName?: string // 공휴일명
}

interface CalendarViewProps {
  onDateClick?: (date: Date) => void
}

export function CalendarView({ onDateClick }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [scheduleData, setScheduleData] = useState<Record<string, DaySchedule>>({})
  const [loading, setLoading] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  // 스케줄 데이터 로딩
  useEffect(() => {
    const fetchScheduleData = async () => {
      setLoading(true)
      try {
        // monthly-view API 사용 (이미 offCount를 정확하게 계산함)
        const response = await fetch(`/api/schedule/monthly-view?year=${year}&month=${month}`, { cache: 'no-store' })
        const result = await response.json()

        console.log('Monthly-view API response:', result)

        if (result.success && result.scheduleData) {
          // monthly-view API는 이미 완전히 계산된 scheduleData를 반환함
          console.log('Final calendar data:', result.scheduleData)
          setScheduleData(result.scheduleData)
        }
      } catch (error) {
        console.error('Failed to fetch schedule:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchScheduleData()
  }, [year, month])

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setIsPopupOpen(true)
    onDateClick?.(date)
  }

  const handleClosePopup = () => {
    setIsPopupOpen(false)
    setSelectedDate(null)
  }

  const handleSaveSchedule = async (schedule: any) => {
    try {
      const response = await fetch('/api/schedule/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule)
      })

      if (response.ok) {
        // 저장 후 스케줄 데이터 새로고침
        const refreshResponse = await fetch(`/api/schedule?year=${year}&month=${month}`)
        const result = await refreshResponse.json()
        if (result.success && result.data) {
          // 데이터 업데이트 로직 재실행
          const data: Record<string, { doctors: Doctor[]; staffCount: number }> = {}
          // ... 위와 동일한 변환 로직
          setScheduleData(data)
        }
      }
    } catch (error) {
      console.error('Failed to save schedule:', error)
      throw error
    }
  }

  // handleApplyPattern 함수 제거 (메인 캘린더에서는 미사용)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <MonthNavigator
            year={year}
            month={month}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
          />
        </div>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      )}

      {!loading && (
        <>
          <CalendarGrid
            year={year}
            month={month}
            scheduleData={scheduleData}
            onDateClick={handleDateClick}
          />

          <DayDetailPopup
            date={selectedDate}
            isOpen={isPopupOpen}
            onClose={handleClosePopup}
            onSave={handleSaveSchedule}
          />
        </>
      )}
    </div>
  )
}
