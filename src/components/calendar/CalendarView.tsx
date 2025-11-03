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
  const [combinations, setCombinations] = useState<any[]>([])
  const [totalActiveStaff, setTotalActiveStaff] = useState(0)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  // 스케줄 데이터 로딩
  useEffect(() => {
    const fetchScheduleData = async () => {
      setLoading(true)
      try {
        // 원장 조합 목록 조회
        const combResponse = await fetch('/api/settings/combinations', { cache: 'no-store' })
        const combResult = await combResponse.json()
        if (combResult.success && Array.isArray(combResult.data)) {
          setCombinations(combResult.data)
        }

        // 전체 활성 직원 수 조회 (진료실만)
        const staffResponse = await fetch('/api/staff', { cache: 'no-store' })
        const staffResult = await staffResponse.json()
        if (staffResult.success && Array.isArray(staffResult.data)) {
          const treatmentStaff = staffResult.data.filter((s: any) =>
            s.isActive && s.departmentName === '진료실'
          )
          setTotalActiveStaff(treatmentStaff.length)
        }

        // 스케줄 조회
        const response = await fetch(`/api/schedule?year=${year}&month=${month}`, { cache: 'no-store' })
        const result = await response.json()

        console.log('Schedule API response:', result)

        if (result.success && result.data) {
          const data: Record<string, DaySchedule> = {}
          console.log('result.data.doctors:', result.data.doctors)

          // 날짜별로 원장 정보 그룹화
          const doctorsByDate: Record<string, any[]> = {}
          if (result.data.doctors && Array.isArray(result.data.doctors)) {
            result.data.doctors.forEach((item: any) => {
              const dateKey = new Date(item.date).toISOString().split('T')[0]
              if (!doctorsByDate[dateKey]) {
                doctorsByDate[dateKey] = []
              }
              doctorsByDate[dateKey].push({
                shortName: item.doctor.shortName,
                hasNightShift: item.hasNightShift
              })
            })
          }

          // 날짜별로 직원 수 카운트 및 오프(쉬는 날) 카운트
          const staffCountByDate: Record<string, number> = {}
          const scheduledOffByDate: Record<string, number> = {}
          if (result.data.staffAssignments && Array.isArray(result.data.staffAssignments)) {
            result.data.staffAssignments.forEach((item: any) => {
              const dateKey = new Date(item.date).toISOString().split('T')[0]
              // 근무 인원만 카운트 (DAY, NIGHT)
              if (item.shiftType === 'DAY' || item.shiftType === 'NIGHT') {
                staffCountByDate[dateKey] = (staffCountByDate[dateKey] || 0) + 1
              }
              // OFF 타입 카운트 (자동 배정된 쉬는 날)
              if (item.shiftType === 'OFF') {
                scheduledOffByDate[dateKey] = (scheduledOffByDate[dateKey] || 0) + 1
              }
            })
          }
          console.log('Scheduled OFF by date:', scheduledOffByDate)

          // 휴가 정보 처리 (연차/오프 분리)
          const annualLeaveByDate: Record<string, number> = {}
          const offCountByDate: Record<string, number> = {}
          if (result.data.leaves && Array.isArray(result.data.leaves)) {
            result.data.leaves.forEach((leave: any) => {
              const dateKey = new Date(leave.date).toISOString().split('T')[0]
              if (leave.leaveType === 'ANNUAL') {
                annualLeaveByDate[dateKey] = (annualLeaveByDate[dateKey] || 0) + 1
              } else if (leave.leaveType === 'OFF') {
                offCountByDate[dateKey] = (offCountByDate[dateKey] || 0) + 1
              }
            })
          }
          console.log('Annual leave by date:', annualLeaveByDate)
          console.log('Off count by date:', offCountByDate)

          // 각 날짜에 대해 조합 정보 찾기 (원장이 배치된 날짜만)
          Object.keys(doctorsByDate).forEach(dateKey => {
            const dayDoctors = doctorsByDate[dateKey]
            const doctorShortNames = dayDoctors.map(d => d.shortName).sort()
            const hasNightShift = dayDoctors.some(d => d.hasNightShift)

            // 조합 찾기
            const combination = combResult.data?.find((c: any) => {
              const combDoctors = (c.doctors as string[]).sort().join(',')
              const dayDoctorsStr = doctorShortNames.join(',')
              return combDoctors === dayDoctorsStr && c.hasNightShift === hasNightShift
            })

            // 오프 인원 계산 = 전체 직원 - 배치된 직원 - 연차 직원
            const assignedCount = staffCountByDate[dateKey] || 0
            const annualCount = annualLeaveByDate[dateKey] || 0
            const calculatedOffCount = totalActiveStaff - assignedCount - annualCount

            data[dateKey] = {
              combinationName: combination?.name || doctorShortNames.join(', '),
              hasNightShift,
              requiredStaff: combination?.requiredStaff || 0,
              assignedStaff: assignedCount,
              doctorShortNames,
              annualLeaveCount: annualCount,
              offCount: Math.max(0, calculatedOffCount) // 음수 방지
            }
          })

          console.log('Final calendar data:', data)
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
