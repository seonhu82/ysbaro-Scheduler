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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  TrendingUp,
  Users,
  AlertTriangle,
  RefreshCw,
  Download
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

      {/* 직원별 통계 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            직원별 통계
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">직원명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">직급</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">근무일</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">전체 기록</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">출근</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">퇴근</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">의심</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y">
              {data.byStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    데이터가 없습니다
                  </td>
                </tr>
              ) : (
                data.byStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {staff.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {staff.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {staff.workDays}일
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold">
                      {staff.totalChecks}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600">
                      {staff.checkIns}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-blue-600">
                      {staff.checkOuts}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {staff.suspicious > 0 ? (
                        <Badge variant="destructive" className="bg-amber-100 text-amber-800">
                          {staff.suspicious}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
