'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface DayLeaves {
  date: string
  dayOfWeek: number
  applications: Array<{
    id: string
    leaveType: 'ANNUAL' | 'OFF'
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    staff: {
      name: string
      rank: string
    }
  }>
}

export default function CalendarViewPage() {
  const [calendarData, setCalendarData] = useState<Record<string, DayLeaves>>({})
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    fetchCalendarData()
  }, [year, month])

  const fetchCalendarData = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/leave-management/calendar-view?year=${year}&month=${month}`
      )
      const result = await response.json()

      if (result.success) {
        setCalendarData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch calendar data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  const getDaysInMonth = () => {
    const date = new Date(year, month - 1, 1)
    const days = []
    const firstDay = date.getDay()
    const lastDate = new Date(year, month, 0).getDate()

    // 이전 달 빈 칸
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // 현재 달 날짜
    for (let i = 1; i <= lastDate; i++) {
      days.push(i)
    }

    return days
  }

  const getLeaveCount = (day: number, status?: string) => {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayData = calendarData[dateKey]
    if (!dayData) return 0

    if (status) {
      return dayData.applications.filter(app => app.status === status).length
    }
    return dayData.applications.length
  }

  const getDayApplications = (day: number) => {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return calendarData[dateKey]?.applications || []
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">연차 관리 - 달력뷰</h1>
        <p>로딩 중...</p>
      </div>
    )
  }

  const days = getDaysInMonth()
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">연차 관리 - 달력뷰</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevMonth}>
            이전
          </Button>
          <span className="font-semibold px-4">
            {year}년 {month}월
          </span>
          <Button variant="outline" size="sm" onClick={handleNextMonth}>
            다음
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>월간 연차 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {/* 요일 헤더 */}
            {dayNames.map((name, idx) => (
              <div
                key={idx}
                className={`text-center font-semibold py-2 ${
                  idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : ''
                }`}
              >
                {name}
              </div>
            ))}

            {/* 날짜 셀 */}
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="aspect-square" />
              }

              const applications = getDayApplications(day)
              const pendingCount = getLeaveCount(day, 'PENDING')
              const approvedCount = getLeaveCount(day, 'APPROVED')
              const isWeekend = idx % 7 === 0 || idx % 7 === 6

              return (
                <div
                  key={day}
                  className={`border rounded-lg p-2 aspect-square overflow-hidden hover:shadow-md transition-shadow ${
                    isWeekend ? 'bg-gray-50' : ''
                  }`}
                >
                  <div
                    className={`text-sm font-semibold mb-1 ${
                      idx % 7 === 0 ? 'text-red-600' : idx % 7 === 6 ? 'text-blue-600' : ''
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-1">
                    {applications.length > 0 ? (
                      <>
                        {applications.slice(0, 2).map((app) => (
                          <div
                            key={app.id}
                            className="text-xs bg-white border rounded px-1 py-0.5 truncate"
                            title={`${app.staff.name} (${app.status})`}
                          >
                            <span className="font-medium">{app.staff.name}</span>
                            {app.status === 'PENDING' && (
                              <Badge variant="secondary" className="ml-1 text-xs">
                                대기
                              </Badge>
                            )}
                          </div>
                        ))}
                        {applications.length > 2 && (
                          <div className="text-xs text-gray-500 text-center">
                            +{applications.length - 2}건 더
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-gray-300 text-center py-1">
                        -
                      </div>
                    )}
                  </div>
                  {(pendingCount > 0 || approvedCount > 0) && (
                    <div className="flex gap-1 mt-1 text-xs">
                      {pendingCount > 0 && (
                        <span className="text-yellow-600">대기 {pendingCount}</span>
                      )}
                      {approvedCount > 0 && (
                        <span className="text-green-600">승인 {approvedCount}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 범례 */}
          <div className="flex gap-4 mt-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" />
              <span>대기 중</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
              <span>승인됨</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
              <span>거절됨</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
