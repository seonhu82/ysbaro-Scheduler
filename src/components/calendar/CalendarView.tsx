'use client'

import { useState, useEffect } from 'react'
import { MonthNavigator } from './MonthNavigator'
import { CalendarGrid } from './CalendarGrid'
import { DayDetailPopup } from './DayDetailPopup'
import { PatternApplyButton } from './PatternApplyButton'

interface Doctor {
  id: string
  name: string
}

interface Schedule {
  id: string
  date: string
  doctors: Doctor[]
  staffCount: number
}

interface CalendarViewProps {
  onDateClick?: (date: Date) => void
}

export function CalendarView({ onDateClick }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [scheduleData, setScheduleData] = useState<Record<string, { doctors: Doctor[]; staffCount: number }>>({})
  const [loading, setLoading] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  // 스케줄 데이터 로딩
  useEffect(() => {
    const fetchScheduleData = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/schedule?year=${year}&month=${month}`)
        const result = await response.json()

        if (result.success && result.data) {
          // 스케줄 데이터를 날짜별로 매핑
          const data: Record<string, { doctors: Doctor[]; staffCount: number }> = {}

          // API 응답에서 스케줄 데이터 변환
          if (result.data.doctors && Array.isArray(result.data.doctors)) {
            result.data.doctors.forEach((item: any) => {
              const dateKey = new Date(item.date).toISOString().split('T')[0]
              if (!data[dateKey]) {
                data[dateKey] = { doctors: [], staffCount: 0 }
              }
              if (item.doctor) {
                data[dateKey].doctors.push({
                  id: item.doctor.id,
                  name: item.doctor.name
                })
              }
            })
          }

          if (result.data.staffAssignments && Array.isArray(result.data.staffAssignments)) {
            result.data.staffAssignments.forEach((item: any) => {
              const dateKey = new Date(item.date).toISOString().split('T')[0]
              if (!data[dateKey]) {
                data[dateKey] = { doctors: [], staffCount: 0 }
              }
              data[dateKey].staffCount++
            })
          }

          setScheduleData(data)
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

  const handleApplyPattern = async (year: number, month: number) => {
    // 패턴 적용 후 스케줄 데이터 새로고침
    const response = await fetch(`/api/schedule?year=${year}&month=${month}`)
    const result = await response.json()
    if (result.success && result.data) {
      setScheduleData({})
    }
  }

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
        <PatternApplyButton onApply={handleApplyPattern} />
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
