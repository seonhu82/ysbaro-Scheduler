'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AttendanceHeatmap } from '@/components/analytics/AttendanceHeatmap'
import { TrendingUp, Calendar, Clock } from 'lucide-react'

interface HeatmapData {
  hourlyByDay: {
    [day: string]: { [hour: string]: number }
  }
  metadata: {
    maxValue: number
    avgValue: number
    totalRecords: number
  }
}

interface ApiResponse {
  period: {
    startDate: string
    endDate: string
  }
  hourlyByDay: HeatmapData['hourlyByDay']
  metadata: HeatmapData['metadata']
}

export default function PatternsPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [departments, setDepartments] = useState<string[]>([])

  // Date range
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await fetch('/api/analytics/individual')
        const result = await response.json()
        if (result.success && result.data.staff) {
          const depts = Array.from(
            new Set(result.data.staff.map((s: any) => s.departmentName).filter(Boolean))
          ) as string[]
          setDepartments(depts)
        }
      } catch (error) {
        console.error('Error fetching departments:', error)
      }
    }
    fetchDepartments()
  }, [])

  // Fetch heatmap data
  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(departmentFilter !== 'all' && { departmentName: departmentFilter }),
      })

      const response = await fetch(`/api/analytics/patterns/heatmap?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        console.error('Failed to fetch data:', result.error)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, departmentFilter])

  // Calculate insights
  const insights = data ? calculateInsights(data) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">시간대별 출근 패턴 분석</h1>
        <p className="text-muted-foreground mt-2">
          요일별 × 시간대별 출근 패턴 히트맵 시각화
        </p>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 출근 기록</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.metadata.totalRecords}건</div>
              <p className="text-xs text-muted-foreground mt-1">
                분석 기간 내 출근 체크
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">피크 시간대</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights?.peakHour || '-'}</div>
              <p className="text-xs text-muted-foreground mt-1">
                최대 {data.metadata.maxValue}회 출근
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">출근 집중도</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights?.concentration || '-'}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                피크 시간대 집중률
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>필터 및 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>기간 시작</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label>기간 종료</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label>부서</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>출근 패턴 히트맵</CardTitle>
          <CardDescription>
            요일별 × 시간대별 출근 빈도 분포 (06:00 - 22:00)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              데이터를 불러오는 중...
            </div>
          ) : !data ? (
            <div className="text-center py-12 text-muted-foreground">
              데이터가 없습니다.
            </div>
          ) : (
            <AttendanceHeatmap
              data={{
                hourlyByDay: data.hourlyByDay,
                metadata: data.metadata,
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {insights && (
        <Card>
          <CardHeader>
            <CardTitle>패턴 인사이트</CardTitle>
            <CardDescription>
              히트맵 데이터 기반 자동 분석 결과
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">출근 패턴 요약</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 가장 많은 출근: {insights.peakDay} {insights.peakHour}</li>
                    <li>• 출근이 적은 요일: {insights.quietDay}</li>
                    <li>• 출근 집중 시간대: {insights.concentrationPeriod}</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">권장사항</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• {insights.recommendation1}</li>
                    <li>• {insights.recommendation2}</li>
                    <li>• {insights.recommendation3}</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper function to calculate insights from heatmap data
function calculateInsights(data: ApiResponse) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const dayLabels: Record<string, string> = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일',
  }

  // Find peak hour and day
  let peakValue = 0
  let peakDay = ''
  let peakHour = ''

  days.forEach(day => {
    Object.entries(data.hourlyByDay[day]).forEach(([hour, value]) => {
      if (value > peakValue) {
        peakValue = value
        peakDay = dayLabels[day]
        peakHour = `${hour}시`
      }
    })
  })

  // Find quietest day
  const dayTotals = days.map(day => ({
    day,
    total: Object.values(data.hourlyByDay[day]).reduce((sum, val) => sum + val, 0),
  }))
  const quietestDay = dayTotals.reduce((min, day) => day.total < min.total ? day : min, dayTotals[0])

  // Calculate concentration (% of records in peak hour)
  const concentration = data.metadata.totalRecords > 0
    ? Math.round((peakValue / data.metadata.totalRecords) * 100)
    : 0

  // Find concentration period (consecutive hours with high activity)
  const threshold = data.metadata.maxValue * 0.7
  let concentrationStart = ''
  let concentrationEnd = ''

  for (const day of days) {
    const hours = Object.entries(data.hourlyByDay[day])
      .filter(([_, value]) => value >= threshold)
      .map(([hour]) => hour)

    if (hours.length > 0) {
      concentrationStart = hours[0]
      concentrationEnd = hours[hours.length - 1]
      break
    }
  }

  const concentrationPeriod = concentrationStart && concentrationEnd
    ? `${concentrationStart}시 - ${concentrationEnd}시`
    : '분석 불가'

  // Generate recommendations
  const recommendation1 = peakValue > data.metadata.avgValue * 2
    ? `${peakHour} 전후로 출근이 집중되므로 시차 출근제 도입을 고려하세요.`
    : '출근 시간이 고르게 분산되어 있습니다.'

  const recommendation2 = quietestDay.total < data.metadata.totalRecords * 0.1
    ? `${dayLabels[quietestDay.day]}의 출근율이 낮습니다. 근무 일정을 확인하세요.`
    : '요일별 출근 분포가 적절합니다.'

  const recommendation3 = concentration > 50
    ? `출근 기록의 ${concentration}%가 특정 시간대에 집중되어 있습니다.`
    : '출근 시간이 비교적 분산되어 있습니다.'

  return {
    peakDay,
    peakHour,
    quietDay: dayLabels[quietestDay.day],
    concentration: String(concentration),
    concentrationPeriod,
    recommendation1,
    recommendation2,
    recommendation3,
  }
}
