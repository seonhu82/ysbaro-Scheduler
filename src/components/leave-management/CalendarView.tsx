'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import {
  getCalendarGridDates,
  formatDate,
  isInMonth,
  isToday,
  isSunday,
  isSaturday,
} from '@/lib/date-utils'
import { DayApplicationsDialog } from './DayApplicationsDialog'
import { Moon } from 'lucide-react'

type LeaveApplication = {
  id: string
  leaveType: 'ANNUAL' | 'OFF'
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ON_HOLD' | 'REJECTED'
  staff: {
    id: string
    name: string
    rank: string
    email: string | null
    departmentName: string | null
    categoryName: string | null
  }
  link: {
    id: string
    year: number
    month: number
    token: string
    status: string
  }
  date?: string
  holdReason?: string | null
}

type DoctorSchedule = {
  doctorName: string
  doctorShortName: string
  hasNightShift: boolean
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  CONFIRMED: 'bg-green-100 text-green-800 border-green-300',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-300',
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarView() {
  const { toast } = useToast()
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [applications, setApplications] = useState<Record<string, LeaveApplication[]>>({})
  const [doctorSchedules, setDoctorSchedules] = useState<Record<string, DoctorSchedule[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [dayDialogOpen, setDayDialogOpen] = useState(false)

  const fetchApplications = async () => {
    try {
      setLoading(true)

      const response = await fetch(
        `/api/leave-management/calendar-view?year=${currentYear}&month=${currentMonth}`
      )
      const result = await response.json()

      if (result.success) {
        setApplications(result.data.applications || {})
        setDoctorSchedules(result.data.doctorSchedules || {})
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: result.error || '연차 신청 데이터를 불러오는데 실패했습니다.',
        })
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error)
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [currentYear, currentMonth])

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth() + 1)
  }

  const handleDateClick = (date: Date) => {
    // 현재 월의 날짜만 클릭 가능
    if (isInMonth(date, currentYear, currentMonth)) {
      setSelectedDate(date)
      setDayDialogOpen(true)
    }
  }

  const handleDayDialogClose = (updated: boolean) => {
    setDayDialogOpen(false)
    setSelectedDate(null)
    if (updated) {
      fetchApplications()
    }
  }

  const calendarDates = getCalendarGridDates(currentYear, currentMonth)

  // 날짜별 신청 가져오기
  const getApplicationsForDate = (date: Date): LeaveApplication[] => {
    const dateKey = formatDate(date)
    return applications[dateKey] || []
  }

  // 날짜별 의사 스케줄 가져오기
  const getDoctorSchedulesForDate = (date: Date): DoctorSchedule[] => {
    const dateKey = formatDate(date)
    return doctorSchedules[dateKey] || []
  }

  // 상태별 통계
  const totalApplications = Object.values(applications).flat()
  const pendingCount = totalApplications.filter((a) => a.status === 'PENDING').length
  const confirmedCount = totalApplications.filter((a) => a.status === 'CONFIRMED').length
  const onHoldCount = totalApplications.filter((a) => a.status === 'ON_HOLD').length
  const rejectedCount = totalApplications.filter((a) => a.status === 'REJECTED').length
  const cancelledCount = totalApplications.filter((a) => a.status === 'CANCELLED').length

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {currentYear}년 {currentMonth}월
          </h2>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleToday}>
              오늘
            </Button>
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchApplications}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 통계 */}
        <div className="flex gap-4 mt-4 pt-4 border-t flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-600">대기: {pendingCount}건</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">승인: {confirmedCount}건</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-sm text-gray-600">보류: {onHoldCount}건</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-600">반려: {rejectedCount}건</span>
          </div>
        </div>
      </Card>

      {/* 캘린더 그리드 */}
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {/* 요일 헤더 */}
          {DAY_LABELS.map((day, index) => (
            <div
              key={day}
              className={`text-center font-semibold text-sm py-2 ${
                index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}

          {/* 날짜 셀 */}
          {calendarDates.map((date, index) => {
            const dateApplications = getApplicationsForDate(date)
            const dateDoctorSchedules = getDoctorSchedulesForDate(date)
            const isCurrentMonth = isInMonth(date, currentYear, currentMonth)
            const isTodayDate = isToday(date)
            const isSundayDate = isSunday(date)
            const isSaturdayDate = isSaturday(date)

            // 상태별 건수 계산
            const pendingApps = dateApplications.filter((a) => a.status === 'PENDING')
            const confirmedApps = dateApplications.filter((a) => a.status === 'CONFIRMED')
            const onHoldApps = dateApplications.filter((a) => a.status === 'ON_HOLD')
            const rejectedApps = dateApplications.filter((a) => a.status === 'REJECTED')
            const cancelledApps = dateApplications.filter((a) => a.status === 'CANCELLED')

            const hasNightShift = dateDoctorSchedules.some((ds) => ds.hasNightShift)
            const doctorShortNames = dateDoctorSchedules.map((ds) => ds.doctorShortName).join(',')

            return (
              <div
                key={index}
                onClick={() => handleDateClick(date)}
                className={`min-h-[120px] p-2 border rounded-lg transition-all ${
                  isCurrentMonth ? 'bg-white hover:bg-blue-50 cursor-pointer' : 'bg-gray-50'
                } ${isTodayDate ? 'ring-2 ring-blue-500' : ''}`}
              >
                {/* 날짜 숫자 및 의사 정보 */}
                <div className="flex items-start justify-between mb-2">
                  <div
                    className={`text-sm font-medium ${
                      !isCurrentMonth
                        ? 'text-gray-400'
                        : isSundayDate
                        ? 'text-red-600'
                        : isSaturdayDate
                        ? 'text-blue-600'
                        : 'text-gray-900'
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  {isCurrentMonth && doctorShortNames && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">{doctorShortNames}</span>
                      {hasNightShift && <Moon className="w-3 h-3 text-blue-500" />}
                    </div>
                  )}
                </div>

                {/* 상태별 건수 표시 */}
                {isCurrentMonth && dateApplications.length > 0 ? (
                  <div className="space-y-1">
                    {pendingApps.length > 0 && (
                      <div className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800 border border-yellow-300 flex items-center justify-between">
                        <span>대기</span>
                        <span className="font-semibold">{pendingApps.length}</span>
                      </div>
                    )}
                    {confirmedApps.length > 0 && (
                      <div className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 border border-green-300 flex items-center justify-between">
                        <span>승인</span>
                        <span className="font-semibold">{confirmedApps.length}</span>
                      </div>
                    )}
                    {onHoldApps.length > 0 && (
                      <div className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-800 border border-orange-300 flex items-center justify-between">
                        <span>보류</span>
                        <span className="font-semibold">{onHoldApps.length}</span>
                      </div>
                    )}
                    {rejectedApps.length > 0 && (
                      <div className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 border border-red-300 flex items-center justify-between">
                        <span>반려</span>
                        <span className="font-semibold">{rejectedApps.length}</span>
                      </div>
                    )}
                    {cancelledApps.length > 0 && (
                      <div className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-300 flex items-center justify-between">
                        <span>취소</span>
                        <span className="font-semibold">{cancelledApps.length}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  isCurrentMonth && (
                    <div className="text-xs text-gray-300 text-center mt-4">-</div>
                  )
                )}
              </div>
            )
          })}
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
              <p className="text-sm text-gray-600">로딩 중...</p>
            </div>
          </div>
        )}
      </Card>

      {/* 일별 신청 관리 다이얼로그 */}
      <DayApplicationsDialog
        open={dayDialogOpen}
        onClose={handleDayDialogClose}
        date={selectedDate}
        applications={selectedDate ? getApplicationsForDate(selectedDate) : []}
        doctorSchedules={selectedDate ? getDoctorSchedulesForDate(selectedDate) : []}
      />
    </div>
  )
}
