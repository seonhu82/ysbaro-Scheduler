'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, TrendingUp, AlertCircle, Play, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

interface WeekSummary {
  weekNumber: number
  startDate: string
  endDate: string
  totalSlots: number
  assignedSlots: number
  issues: number
}

export default function ScheduleManagementPage() {
  const { toast } = useToast()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [weekSummaries, setWeekSummaries] = useState<WeekSummary[]>([])
  const [totalStaff, setTotalStaff] = useState(0)
  const [treatmentStaff, setTreatmentStaff] = useState(0)
  const [loading, setLoading] = useState(true)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // 주차 요약 조회
        const summaryResponse = await fetch(`/api/schedule/summary?year=${year}&month=${month}`)
        const summaryResult = await summaryResponse.json()

        if (summaryResult.success && Array.isArray(summaryResult.data)) {
          setWeekSummaries(summaryResult.data)
        } else {
          setWeekSummaries([])
        }

        // 전체 직원 수 조회
        const staffResponse = await fetch('/api/staff')
        const staffResult = await staffResponse.json()

        if (staffResult.success && Array.isArray(staffResult.data)) {
          const allStaff = staffResult.data
          setTotalStaff(allStaff.length)

          // 진료실 직원만 카운트 (배치 가능 인원)
          const treatment = allStaff.filter((staff: any) =>
            staff.departmentName === '진료실' && staff.categoryName
          )
          setTreatmentStaff(treatment.length)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setWeekSummaries([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentMonth, year, month])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">스케줄 관리</h1>
        <p className="text-gray-600">
          원장 및 직원 스케줄 배치, 슬롯 현황을 관리합니다
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
                  <h3 className="font-semibold">원장 스케줄 배치</h3>
                  <p className="text-sm text-gray-500">주간 패턴 기반 배치</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/schedule/monthly-wizard">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">직원 스케줄 배치</h3>
                  <p className="text-sm text-gray-500">형평성 기반 자동 배정</p>
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
                <div className="bg-amber-100 p-3 rounded-lg">
                  <Calendar className="w-6 h-6 text-amber-600" />
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
          ) : !weekSummaries || weekSummaries.length === 0 ? (
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
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-blue-600">{treatmentStaff}</p>
                  <p className="text-lg text-gray-400">/</p>
                  <p className="text-lg text-gray-600">{totalStaff}명</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">배치인원 / 총인원</p>
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
                <p className="text-2xl font-bold">{weekSummaries?.length || 0}주</p>
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
                  {weekSummaries && weekSummaries.length > 0
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
                  {weekSummaries ? weekSummaries.reduce((sum, w) => sum + w.issues, 0) : 0}건
                </p>
              </div>
              <AlertCircle
                className={`w-8 h-8 ${
                  weekSummaries && weekSummaries.reduce((sum, w) => sum + w.issues, 0) > 0
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
