/**
 * 스케줄 조회 공개 페이지
 * 경로: /schedule-view/[token]
 *
 * 기능:
 * - 토큰 기반 스케줄 조회
 * - 월별 캘린더 뷰
 * - 직원별 근무 일정 표시
 * - 연차/오프 표시
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, ChevronLeft, ChevronRight, Users, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ScheduleDay {
  date: string
  dayOfWeek: number
  isHoliday: boolean
  holidayName?: string
  assignments: {
    staff: {
      id: string
      name: string
      rank: string
    }
    hasNightShift: boolean
    leaveType?: 'ANNUAL' | 'OFF'
    leaveStatus?: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  }[]
}

interface ScheduleData {
  year: number
  month: number
  days: ScheduleDay[]
  clinicName?: string
}

export default function ScheduleViewPage({
  params,
}: {
  params: { token: string }
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    fetchSchedule()
  }, [currentYear, currentMonth])

  const fetchSchedule = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/public/schedule-view/${params.token}?year=${currentYear}&month=${currentMonth}`
      )
      const data = await response.json()

      if (data.success) {
        setScheduleData(data.data)
      } else {
        toast({
          variant: 'destructive',
          title: '조회 실패',
          description: data.error || '스케줄을 불러올 수 없습니다'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(12)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const getDayOfWeekName = (dayOfWeek: number) => {
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return days[dayOfWeek]
  }

  const getDayColor = (dayOfWeek: number) => {
    if (dayOfWeek === 0) return 'text-red-600' // 일요일
    if (dayOfWeek === 6) return 'text-blue-600' // 토요일
    return 'text-gray-900'
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 animate-spin text-blue-500" />
          <p className="text-gray-500">스케줄 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!scheduleData) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card className="p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold mb-2">스케줄을 찾을 수 없습니다</h2>
          <p className="text-gray-600">
            유효하지 않은 링크이거나 만료된 스케줄입니다
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">근무 스케줄</h1>
        </div>
        {scheduleData.clinicName && (
          <p className="text-gray-600">{scheduleData.clinicName}</p>
        )}
      </div>

      {/* 월 네비게이션 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              이전 달
            </Button>
            <h2 className="text-2xl font-bold">
              {currentYear}년 {currentMonth}월
            </h2>
            <Button variant="outline" onClick={handleNextMonth}>
              다음 달
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 스케줄 캘린더 */}
      <div className="space-y-3">
        {scheduleData.days.map((day) => {
          const date = new Date(day.date)
          const dayOfWeekName = getDayOfWeekName(day.dayOfWeek)
          const dayColor = getDayColor(day.dayOfWeek)

          return (
            <Card key={day.date} className={day.isHoliday ? 'bg-red-50 border-red-200' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`text-lg font-bold ${dayColor}`}>
                      {date.getDate()}일 ({dayOfWeekName})
                    </div>
                    {day.isHoliday && (
                      <Badge variant="destructive" className="bg-red-100 text-red-800">
                        {day.holidayName || '휴업일'}
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-3 h-3" />
                    {day.assignments.length}명 근무
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {day.assignments.length === 0 ? (
                  <p className="text-gray-500 text-sm">근무자 없음</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {day.assignments.map((assignment, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{assignment.staff.name}</span>
                          {assignment.hasNightShift && (
                            <Badge variant="secondary" className="text-xs">
                              야간
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 mb-2">
                          {assignment.staff.rank}
                        </div>
                        {assignment.leaveType && (
                          <Badge
                            variant={
                              assignment.leaveStatus === 'CONFIRMED'
                                ? 'default'
                                : 'outline'
                            }
                            className="text-xs"
                          >
                            {assignment.leaveType === 'ANNUAL' ? '연차' : '오프'}
                            {assignment.leaveStatus === 'PENDING' && ' (대기)'}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 범례 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>범례</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>야간 근무</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>연차 (확정)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>오프 (확정)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>휴업일</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
