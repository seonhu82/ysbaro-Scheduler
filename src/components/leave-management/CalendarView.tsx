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

type LeaveApplication = {
  id: string
  leaveType: 'ANNUAL' | 'OFF'
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  staff: {
    id: string
    name: string
    rank: string
    email: string | null
  }
  link: {
    id: string
    year: number
    month: number
    token: string
    status: string
  }
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
  const [loading, setLoading] = useState(true)

  const fetchApplications = async () => {
    try {
      setLoading(true)

      const response = await fetch(
        `/api/leave-management/calendar-view?year=${currentYear}&month=${currentMonth}`
      )
      const result = await response.json()

      if (result.success) {
        setApplications(result.data)
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

  const calendarDates = getCalendarGridDates(currentYear, currentMonth)

  // 날짜별 신청 건수 계산
  const getApplicationsForDate = (date: Date): LeaveApplication[] => {
    const dateKey = formatDate(date)
    return applications[dateKey] || []
  }

  // 상태별 통계
  const totalApplications = Object.values(applications).flat()
  const pendingCount = totalApplications.filter((a) => a.status === 'PENDING').length
  const confirmedCount = totalApplications.filter((a) => a.status === 'CONFIRMED').length
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
        <div className="flex gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-600">대기: {pendingCount}건</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">승인: {confirmedCount}건</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="text-sm text-gray-600">취소: {cancelledCount}건</span>
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
            const isCurrentMonth = isInMonth(date, currentYear, currentMonth)
            const isTodayDate = isToday(date)
            const isSundayDate = isSunday(date)
            const isSaturdayDate = isSaturday(date)

            return (
              <div
                key={index}
                className={`min-h-[120px] p-2 border rounded-lg ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${isTodayDate ? 'ring-2 ring-blue-500' : ''}`}
              >
                {/* 날짜 숫자 */}
                <div
                  className={`text-sm font-medium mb-1 ${
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

                {/* 연차 신청 목록 */}
                {dateApplications.length > 0 ? (
                  <div className="space-y-1">
                    {dateApplications.slice(0, 3).map((app) => (
                      <div
                        key={app.id}
                        className={`text-xs px-2 py-1 rounded border ${STATUS_COLORS[app.status]}`}
                      >
                        <div className="font-medium truncate">{app.staff.name}</div>
                        <div className="text-[10px] opacity-80">
                          {app.leaveType === 'ANNUAL' ? '연차' : '오프'}
                        </div>
                      </div>
                    ))}
                    {dateApplications.length > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{dateApplications.length - 3}건 더
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

      {/* 범례 */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">범례</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS.PENDING}>대기중</Badge>
            <span className="text-sm text-gray-600">승인 대기 중인 신청</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS.CONFIRMED}>승인</Badge>
            <span className="text-sm text-gray-600">승인된 연차</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS.CANCELLED}>취소</Badge>
            <span className="text-sm text-gray-600">취소된 신청</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
