/**
 * 출퇴근 통계 컴포넌트
 *
 * 기능:
 * - 월별 출퇴근 통계
 * - 지각/조퇴 통계
 * - 직원별 통계
 * - 차트 표시
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AttendanceStats {
  totalPresent: number
  totalLate: number
  totalEarlyLeave: number
  totalAbsent: number
  attendanceRate: number
  punctualityRate: number
}

export function AttendanceStatistics() {
  const [stats, setStats] = useState<AttendanceStats>({
    totalPresent: 0,
    totalLate: 0,
    totalEarlyLeave: 0,
    totalAbsent: 0,
    attendanceRate: 0,
    punctualityRate: 0
  })
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    fetchStatistics()
  }, [year, month])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/attendance/statistics?year=${year}&month=${month}`)
      const result = await response.json()

      if (result.success) {
        setStats(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="border rounded px-3 py-2"
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
          className="border rounded px-3 py-2"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">총 출근</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{loading ? '-' : stats.totalPresent}</p>
            <p className="text-xs text-gray-500 mt-1">이번 달</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">지각</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{loading ? '-' : stats.totalLate}</p>
            <p className="text-xs text-gray-500 mt-1">이번 달</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">조퇴</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">
              {loading ? '-' : stats.totalEarlyLeave}
            </p>
            <p className="text-xs text-gray-500 mt-1">이번 달</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">정상 출근율</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">
              {loading ? '-' : `${stats.punctualityRate.toFixed(1)}%`}
            </p>
            <p className="text-xs text-gray-500 mt-1">이번 달</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">출석률</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all"
                style={{ width: loading ? '0%' : `${stats.attendanceRate}%` }}
              />
            </div>
            <span className="font-bold">
              {loading ? '-' : `${stats.attendanceRate.toFixed(1)}%`}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
