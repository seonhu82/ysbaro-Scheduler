'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ArrowLeft, Calendar, Clock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'

interface TimeSeriesEntry {
  date: string
  checkIn: string | null
  checkOut: string | null
  isLate: boolean
  lateMinutes: number
  isEarlyLeave: boolean
  earlyMinutes: number
  checkInMethod: string | null
  checkOutMethod: string | null
  isSuspicious: boolean
  suspiciousReason: string | null
}

interface AnalyticsData {
  staff: {
    id: string
    name: string
    departmentName: string | null
    categoryName: string | null
    rank: string | null
    workType: string
  }
  period: {
    startDate: string
    endDate: string
    totalDays: number
  }
  summary: {
    totalDays: number
    checkedInDays: number
    attendanceRate: number
    avgCheckInTime: string | null
    avgCheckOutTime: string | null
    lateCount: number
    earlyLeaveCount: number
    onTimeRate: number
    totalCheckIns: number
    totalCheckOuts: number
    suspiciousCount: number
  }
  timeSeries: TimeSeriesEntry[]
  patterns: {
    checkInDistribution: Record<string, number>
    dayOfWeekTrend: Array<{
      day: string
      count: number
      lateRate: number
      avgCheckIn: string | null
    }>
  }
}

export default function StaffDetailPage() {
  const params = useParams()
  const staffId = params.staffId as string

  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  // Date range
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Fetch data
  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const response = await fetch(`/api/analytics/individual/${staffId}?${params}`)
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
  }, [staffId, startDate, endDate])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-semibold">데이터를 불러오는 중...</div>
        </div>
      </div>
    )
  }

  // Prepare chart data for timeline
  const timelineData = data.timeSeries.map(entry => {
    const checkInMinutes = entry.checkIn
      ? parseInt(entry.checkIn.split(':')[0]) * 60 + parseInt(entry.checkIn.split(':')[1])
      : null
    const checkOutMinutes = entry.checkOut
      ? parseInt(entry.checkOut.split(':')[0]) * 60 + parseInt(entry.checkOut.split(':')[1])
      : null

    return {
      date: entry.date.split('-').slice(1).join('/'), // MM/DD format
      checkIn: checkInMinutes,
      checkOut: checkOutMinutes,
      isLate: entry.isLate,
      isEarlyLeave: entry.isEarlyLeave,
    }
  }).filter(entry => entry.checkIn !== null || entry.checkOut !== null)

  // Prepare day of week chart data
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const dayLabels: Record<string, string> = {
    monday: '월',
    tuesday: '화',
    wednesday: '수',
    thursday: '목',
    friday: '금',
    saturday: '토',
    sunday: '일',
  }
  const dayOfWeekData = dayOrder.map(day => {
    const dayData = data.patterns.dayOfWeekTrend.find(d => d.day === day)
    return {
      day: dayLabels[day],
      count: dayData?.count || 0,
      lateRate: dayData?.lateRate || 0,
    }
  })

  // Prepare hourly distribution data
  const hourlyData = Object.entries(data.patterns.checkInDistribution)
    .map(([range, count]) => ({
      time: range.split('-')[0],
      count,
    }))
    .sort((a, b) => a.time.localeCompare(b.time))

  // Get suspicious records
  const suspiciousRecords = data.timeSeries.filter(entry => entry.isSuspicious)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/analytics/individual">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{data.staff.name}</h1>
            <p className="text-muted-foreground mt-1">
              {data.staff.departmentName} · {data.staff.rank} · {data.staff.categoryName}
            </p>
          </div>
        </div>

        {/* Date Range */}
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-xs">기간 시작</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[140px]"
            />
          </div>
          <div>
            <Label className="text-xs">기간 종료</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[140px]"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">출근율</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.attendanceRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.summary.checkedInDays}/{data.summary.totalDays}일 출근
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">정시 출근율</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.onTimeRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              지각 {data.summary.lateCount}회
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 출근</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.avgCheckInTime || '-'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              기준 09:00
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 퇴근</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.avgCheckOutTime || '-'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              조퇴 {data.summary.earlyLeaveCount}회
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이상 징후</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.suspiciousCount}건</div>
            <p className="text-xs text-muted-foreground mt-1">
              전체 기록 중
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="timeline">타임라인</TabsTrigger>
          <TabsTrigger value="patterns">패턴 분석</TabsTrigger>
          <TabsTrigger value="anomalies">이상 징후</TabsTrigger>
          <TabsTrigger value="records">상세 기록</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>출퇴근 현황</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">총 근무일</span>
                    <span className="font-semibold">{data.summary.totalDays}일</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">출근일</span>
                    <span className="font-semibold">{data.summary.checkedInDays}일</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">미출근일</span>
                    <span className="font-semibold text-red-600">
                      {data.summary.totalDays - data.summary.checkedInDays}일
                    </span>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">총 출근 기록</span>
                    <span className="font-semibold">{data.summary.totalCheckIns}회</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">총 퇴근 기록</span>
                    <span className="font-semibold">{data.summary.totalCheckOuts}회</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>근태 현황</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">지각</span>
                    <span className="font-semibold text-red-600">{data.summary.lateCount}회</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">조퇴</span>
                    <span className="font-semibold text-orange-600">{data.summary.earlyLeaveCount}회</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">이상 징후</span>
                    <span className="font-semibold text-yellow-600">{data.summary.suspiciousCount}건</span>
                  </div>
                </div>
                <div className="h-px bg-border" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">정시 출근율</span>
                    <span className="font-semibold">{data.summary.onTimeRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">평균 출근 시간</span>
                    <span className="font-semibold">{data.summary.avgCheckInTime || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">평균 퇴근 시간</span>
                    <span className="font-semibold">{data.summary.avgCheckOutTime || '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>출퇴근 시간 추이</CardTitle>
              <CardDescription>
                시간 경과에 따른 출퇴근 시간 변화 (분 단위)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timelineData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  출퇴근 기록이 없습니다.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      label={{ value: '시간 (분)', angle: -90, position: 'insideLeft' }}
                      domain={[480, 1200]} // 08:00 (480) to 20:00 (1200)
                      ticks={[480, 540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200]}
                      tickFormatter={(value) => {
                        const hours = Math.floor(value / 60)
                        const minutes = value % 60
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
                      }}
                    />
                    <Tooltip
                      labelFormatter={(label) => `날짜: ${label}`}
                      formatter={(value: any) => {
                        if (value === null) return '-'
                        const hours = Math.floor(value / 60)
                        const minutes = value % 60
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="checkIn"
                      stroke="#8884d8"
                      name="출근"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="checkOut"
                      stroke="#82ca9d"
                      name="퇴근"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>요일별 출근 패턴</CardTitle>
                <CardDescription>
                  요일별 출근 횟수 및 지각률
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dayOfWeekData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="출근 횟수" />
                    <Bar yAxisId="right" dataKey="lateRate" fill="#ffc658" name="지각률 (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>시간대별 출근 분포</CardTitle>
                <CardDescription>
                  출근 시간대별 빈도
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hourlyData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    데이터가 없습니다.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" name="출근 횟수" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Day of week details table */}
          <Card>
            <CardHeader>
              <CardTitle>요일별 상세 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>요일</TableHead>
                    <TableHead className="text-right">출근 횟수</TableHead>
                    <TableHead className="text-right">지각률</TableHead>
                    <TableHead className="text-center">평균 출근 시간</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayOrder.map(day => {
                    const dayData = data.patterns.dayOfWeekTrend.find(d => d.day === day)
                    return (
                      <TableRow key={day}>
                        <TableCell className="font-medium">{dayLabels[day]}요일</TableCell>
                        <TableCell className="text-right">{dayData?.count || 0}회</TableCell>
                        <TableCell className="text-right">
                          {dayData && dayData.count > 0
                            ? `${dayData.lateRate.toFixed(1)}%`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {dayData?.avgCheckIn || '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>이상 징후 목록 ({suspiciousRecords.length}건)</CardTitle>
              <CardDescription>
                의심스러운 패턴이 감지된 출퇴근 기록
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suspiciousRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  이상 징후가 없습니다.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead className="text-center">출근</TableHead>
                      <TableHead className="text-center">퇴근</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suspiciousRecords.map((record, index) => (
                      <TableRow key={index}>
                        <TableCell>{record.date}</TableCell>
                        <TableCell className="text-center">
                          {record.checkIn || '-'}
                          {record.isLate && (
                            <Badge variant="destructive" className="ml-2">
                              지각 {record.lateMinutes}분
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {record.checkOut || '-'}
                          {record.isEarlyLeave && (
                            <Badge variant="secondary" className="ml-2">
                              조퇴 {record.earlyMinutes}분
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {record.suspiciousReason || '감지됨'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-yellow-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            의심
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>전체 출퇴근 기록 ({data.timeSeries.length}일)</CardTitle>
              <CardDescription>
                기간 내 모든 출퇴근 기록
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead className="text-center">출근</TableHead>
                    <TableHead className="text-center">퇴근</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead>출근 방법</TableHead>
                    <TableHead>퇴근 방법</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.timeSeries.slice().reverse().map((record, index) => (
                    <TableRow key={index}>
                      <TableCell>{record.date}</TableCell>
                      <TableCell className="text-center">
                        {record.checkIn || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.checkOut || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {!record.checkIn ? (
                          <Badge variant="secondary">미출근</Badge>
                        ) : record.isLate ? (
                          <Badge variant="destructive">지각</Badge>
                        ) : record.isEarlyLeave ? (
                          <Badge variant="secondary">조퇴</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600">정상</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {record.checkInMethod || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {record.checkOutMethod || '-'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
