/**
 * 출퇴근 통계 페이지
 * 경로: /attendance/statistics
 *
 * 기능:
 * - 월별 출퇴근 통계
 * - 지각/조퇴 통계
 * - 직원별 근태 현황
 * - 차트 표시
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart3,
  TrendingUp,
  Users,
  AlertTriangle,
  RefreshCw,
  Download,
  ArrowRight,
  Calendar,
  Clock
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface StaffStats {
  id: string
  name: string
  rank: string
  totalChecks: number
  checkIns: number
  checkOuts: number
  suspicious: number
  workDays: number
}

interface DailyStats {
  date: string
  checkIns: number
  checkOuts: number
  suspicious: number
}

interface StatisticsData {
  period: {
    year: number
    month: number
    startDate: string
    endDate: string
  }
  summary: {
    totalChecks: number
    totalCheckIns: number
    totalCheckOuts: number
    suspiciousCount: number
  }
  byStaff: StaffStats[]
  dailyStats: DailyStats[]
}

export default function AttendanceStatisticsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<StatisticsData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('year', year.toString())
      params.append('month', month.toString())

      const response = await fetch(`/api/attendance/statistics?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: result.error
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

  useEffect(() => {
    fetchStatistics()
  }, [])

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

  const handleExport = () => {
    toast({
      title: 'Excel 다운로드',
      description: '준비 중입니다...'
    })
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-500" />
          <p className="text-gray-500">통계 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-gray-500">데이터를 불러올 수 없습니다</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">출퇴근 통계</h1>
          <p className="text-gray-600">
            월별 출퇴근 현황과 직원별 통계를 확인합니다
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Excel
        </Button>
      </div>

      {/* 기간 선택 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handlePrevMonth}>
              이전
            </Button>
            <div className="flex items-center gap-4">
              <div>
                <Label htmlFor="year" className="sr-only">연도</Label>
                <Input
                  id="year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="w-24 text-center"
                />
              </div>
              <span className="text-lg font-semibold">년</span>
              <div>
                <Label htmlFor="month" className="sr-only">월</Label>
                <Input
                  id="month"
                  type="number"
                  min="1"
                  max="12"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="w-20 text-center"
                />
              </div>
              <span className="text-lg font-semibold">월</span>
            </div>
            <Button variant="outline" onClick={handleNextMonth}>
              다음
            </Button>
          </div>
          <div className="text-center mt-4">
            <Button onClick={fetchStatistics}>
              <RefreshCw className="w-4 h-4 mr-2" />
              조회
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              전체 기록
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{data.summary.totalChecks}</div>
              <BarChart3 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              출근
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-green-600">{data.summary.totalCheckIns}</div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              퇴근
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-blue-600">{data.summary.totalCheckOuts}</div>
              <TrendingUp className="w-8 h-8 text-blue-500 rotate-180" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              의심 패턴
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-amber-600">{data.summary.suspiciousCount}</div>
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 일별 통계 차트 (간단한 바 차트) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>일별 출퇴근 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.dailyStats.length === 0 ? (
              <p className="text-gray-500 text-center py-8">데이터가 없습니다</p>
            ) : (
              data.dailyStats.map((daily) => (
                <div key={daily.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">
                    {new Date(daily.date).toLocaleDateString('ko-KR', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="flex-1 flex gap-2">
                    <div
                      className="bg-green-500 h-6 rounded flex items-center justify-center text-white text-xs"
                      style={{ width: `${(daily.checkIns / Math.max(...data.dailyStats.map(d => d.checkIns))) * 100}%`, minWidth: daily.checkIns > 0 ? '40px' : '0' }}
                    >
                      {daily.checkIns > 0 && `출근 ${daily.checkIns}`}
                    </div>
                    <div
                      className="bg-blue-500 h-6 rounded flex items-center justify-center text-white text-xs"
                      style={{ width: `${(daily.checkOuts / Math.max(...data.dailyStats.map(d => d.checkOuts))) * 100}%`, minWidth: daily.checkOuts > 0 ? '40px' : '0' }}
                    >
                      {daily.checkOuts > 0 && `퇴근 ${daily.checkOuts}`}
                    </div>
                  </div>
                  {daily.suspicious > 0 && (
                    <Badge variant="destructive" className="bg-amber-100 text-amber-800">
                      의심 {daily.suspicious}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 고급 분석 도구 바로가기 */}
      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            고급 출퇴근 분석
          </CardTitle>
          <CardDescription>
            더 상세한 패턴 분석 및 인사이트를 확인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/analytics/individual" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white hover:bg-blue-50 transition-colors border border-blue-100">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">개인별 분석</div>
                  <div className="text-xs text-muted-foreground">직원별 상세 패턴</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/analytics/patterns" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white hover:bg-blue-50 transition-colors border border-blue-100">
                <Calendar className="h-8 w-8 text-green-600" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">시간대 분석</div>
                  <div className="text-xs text-muted-foreground">히트맵 시각화</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/analytics/anomalies" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white hover:bg-blue-50 transition-colors border border-blue-100">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">이상 징후</div>
                  <div className="text-xs text-muted-foreground">자동 감지</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>

            <Link href="/analytics/comparison" className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white hover:bg-blue-50 transition-colors border border-blue-100">
                <BarChart3 className="h-8 w-8 text-purple-600" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">부서별 비교</div>
                  <div className="text-xs text-muted-foreground">KPI 분석</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 직원별 통계 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            직원별 통계
          </CardTitle>
          <CardDescription>
            클릭하여 개인별 상세 분석 보기
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>직원명</TableHead>
                <TableHead>직급</TableHead>
                <TableHead className="text-center">근무일</TableHead>
                <TableHead className="text-center">전체 기록</TableHead>
                <TableHead className="text-center">출근</TableHead>
                <TableHead className="text-center">퇴근</TableHead>
                <TableHead className="text-center">의심</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                data.byStaff.map((staff) => (
                  <TableRow key={staff.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell className="text-muted-foreground">{staff.rank}</TableCell>
                    <TableCell className="text-center">{staff.workDays}일</TableCell>
                    <TableCell className="text-center font-semibold">{staff.totalChecks}</TableCell>
                    <TableCell className="text-center text-green-600">{staff.checkIns}</TableCell>
                    <TableCell className="text-center text-blue-600">{staff.checkOuts}</TableCell>
                    <TableCell className="text-center">
                      {staff.suspicious > 0 ? (
                        <Badge variant="destructive" className="bg-amber-100 text-amber-800">
                          {staff.suspicious}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/analytics/individual/${staff.id}`}>
                        <Button variant="outline" size="sm">
                          상세보기
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
