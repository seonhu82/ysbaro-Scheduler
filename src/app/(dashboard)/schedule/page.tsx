'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, TrendingUp, AlertCircle, Play, BarChart3 } from 'lucide-react'
import Link from 'next/link'

interface WeekSummary {
  weekNumber: number
  startDate: string
  endDate: string
  totalSlots: number
  assignedSlots: number
  issues: number
}

export default function ScheduleManagementPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [weekSummaries, setWeekSummaries] = useState<WeekSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWeekSummaries = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/schedule/summary?year=${year}&month=${month}`)
        const result = await response.json()

        if (result.success && result.data) {
          setWeekSummaries(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch week summaries:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchWeekSummaries()
  }, [currentMonth])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">스케줄 관리</h1>
        <p className="text-gray-600">
          주간 스케줄 생성, 직원 배치, 슬롯 현황을 관리합니다
        </p>
      </div>

      {/* 빠른 작업 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="/schedule/auto-assign">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Play className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">자동 배치</h3>
                  <p className="text-sm text-gray-500">주간 스케줄 생성</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/schedule/slots">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">슬롯 현황</h3>
                  <p className="text-sm text-gray-500">구분별 가용 슬롯</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/calendar">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">캘린더</h3>
                  <p className="text-sm text-gray-500">월간 스케줄 보기</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 현재 달 요약 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {year}년 {month}월 스케줄 요약
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(year, month - 2, 1))}
              >
                이전 달
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                오늘
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(year, month, 1))}
              >
                다음 달
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : weekSummaries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              이번 달 스케줄이 없습니다
            </div>
          ) : (
            <div className="space-y-3">
              {weekSummaries.map((week) => (
                <div
                  key={week.weekNumber}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline">
                          {week.weekNumber}주차
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {week.startDate} ~ {week.endDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span>
                            배치: {week.assignedSlots}/{week.totalSlots}
                          </span>
                        </div>
                        {week.issues > 0 && (
                          <div className="flex items-center gap-1 text-amber-600">
                            <AlertCircle className="w-4 h-4" />
                            <span>문제: {week.issues}건</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {week.assignedSlots === week.totalSlots ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          완료
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          진행중
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">전체 직원</p>
                <p className="text-2xl font-bold">15명</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">이번 달 주차</p>
                <p className="text-2xl font-bold">{weekSummaries.length}주</p>
              </div>
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">배치율</p>
                <p className="text-2xl font-bold">
                  {weekSummaries.length > 0
                    ? Math.round(
                        (weekSummaries.reduce((sum, w) => sum + w.assignedSlots, 0) /
                          weekSummaries.reduce((sum, w) => sum + w.totalSlots, 0)) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">문제 발생</p>
                <p className="text-2xl font-bold">
                  {weekSummaries.reduce((sum, w) => sum + w.issues, 0)}건
                </p>
              </div>
              <AlertCircle
                className={`w-8 h-8 ${
                  weekSummaries.reduce((sum, w) => sum + w.issues, 0) > 0
                    ? 'text-amber-500'
                    : 'text-gray-400'
                }`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
