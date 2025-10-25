'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface StatisticsData {
  period: string
  schedules: {
    total: number
    draft: number
    confirmed: number
    deployed: number
    totalAssignments: number
  }
  leaves: {
    total: number
    pending: number
    approved: number
    rejected: number
    annual: number
    off: number
  }
  staff: {
    total: number
    byRank: Record<string, number>
    byWorkType: Record<string, number>
  }
  attendance: {
    total: number
    checkIn: number
    checkOut: number
    suspicious: number
  }
  monthlyTrend?: Array<{
    month: number
    schedules: number
    leaves: number
    attendance: number
  }>
}

export default function StatisticsPage() {
  const [data, setData] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState<number | null>(null)

  useEffect(() => {
    fetchStatistics()
  }, [year, month])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ year: year.toString() })
      if (month) {
        params.append('month', month.toString())
      }

      const response = await fetch(`/api/statistics?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrevYear = () => setYear(year - 1)
  const handleNextYear = () => setYear(year + 1)

  const handleMonthSelect = (m: number | null) => setMonth(m)

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">통계</h1>
        <p>로딩 중...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">통계</h1>
        <p>데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">통계 대시보드</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevYear}>
              이전
            </Button>
            <span className="font-semibold">{year}년</span>
            <Button variant="outline" size="sm" onClick={handleNextYear}>
              다음
            </Button>
          </div>
          <select
            value={month || ''}
            onChange={(e) => handleMonthSelect(e.target.value ? parseInt(e.target.value) : null)}
            className="border rounded px-3 py-1"
          >
            <option value="">연간</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">기간: {data.period}</div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">스케줄</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.schedules.total}</div>
            <div className="text-xs text-gray-500 mt-2">
              확정: {data.schedules.confirmed} / 배포: {data.schedules.deployed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">연차 신청</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.leaves.total}</div>
            <div className="text-xs text-gray-500 mt-2">
              승인: {data.leaves.approved} / 대기: {data.leaves.pending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">직원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.staff.total}</div>
            <div className="text-xs text-gray-500 mt-2">활성 직원</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">출퇴근 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.attendance.total}</div>
            <div className="text-xs text-gray-500 mt-2">
              출근: {data.attendance.checkIn} / 퇴근: {data.attendance.checkOut}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 상세 통계 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 스케줄 상세 */}
        <Card>
          <CardHeader>
            <CardTitle>스케줄 상태</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>임시저장</span>
                <span className="font-semibold">{data.schedules.draft}</span>
              </div>
              <div className="flex justify-between">
                <span>확정</span>
                <span className="font-semibold">{data.schedules.confirmed}</span>
              </div>
              <div className="flex justify-between">
                <span>배포</span>
                <span className="font-semibold">{data.schedules.deployed}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>총 배정 수</span>
                <span className="font-semibold">{data.schedules.totalAssignments}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 연차 상세 */}
        <Card>
          <CardHeader>
            <CardTitle>연차 신청 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>대기</span>
                <span className="font-semibold text-yellow-600">{data.leaves.pending}</span>
              </div>
              <div className="flex justify-between">
                <span>승인</span>
                <span className="font-semibold text-green-600">{data.leaves.approved}</span>
              </div>
              <div className="flex justify-between">
                <span>거절</span>
                <span className="font-semibold text-red-600">{data.leaves.rejected}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>연차</span>
                <span className="font-semibold">{data.leaves.annual}</span>
              </div>
              <div className="flex justify-between">
                <span>오프</span>
                <span className="font-semibold">{data.leaves.off}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 직원 직급별 */}
        <Card>
          <CardHeader>
            <CardTitle>직급별 직원 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.staff.byRank).map(([rank, count]) => (
                <div key={rank} className="flex justify-between">
                  <span>{rank}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 출퇴근 상세 */}
        <Card>
          <CardHeader>
            <CardTitle>출퇴근 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>출근</span>
                <span className="font-semibold">{data.attendance.checkIn}</span>
              </div>
              <div className="flex justify-between">
                <span>퇴근</span>
                <span className="font-semibold">{data.attendance.checkOut}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>의심 기록</span>
                <span className="font-semibold">{data.attendance.suspicious}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 월별 추이 (연간 조회시) */}
      {data.monthlyTrend && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>월별 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">월</th>
                    <th className="text-right py-2">스케줄</th>
                    <th className="text-right py-2">연차</th>
                    <th className="text-right py-2">출퇴근</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyTrend.map((trend) => (
                    <tr key={trend.month} className="border-b">
                      <td className="py-2">{trend.month}월</td>
                      <td className="text-right">{trend.schedules}</td>
                      <td className="text-right">{trend.leaves}</td>
                      <td className="text-right">{trend.attendance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
