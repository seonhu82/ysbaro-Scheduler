'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useStatistics } from '@/lib/hooks/use-statistics'

interface MonthlyTrendProps {
  year: number
  month: number
}

export function MonthlyTrend({ year, month }: MonthlyTrendProps) {
  const { monthlyTrend, isLoadingTrend } = useStatistics(year, month)

  if (isLoadingTrend) {
    return <p className="text-center py-8">로딩 중...</p>
  }

  if (!monthlyTrend || monthlyTrend.length === 0) {
    return <p className="text-center py-8">추세 데이터가 없습니다</p>
  }

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (current < previous) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-600" />
  }

  const getTrendColor = (current: number, previous: number) => {
    if (current > previous) return 'text-green-600'
    if (current < previous) return 'text-red-600'
    return 'text-gray-600'
  }

  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>월별 추세</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monthlyTrend.map((data, index) => {
              const prevData = index < monthlyTrend.length - 1 ? monthlyTrend[index + 1] : null

              return (
                <div
                  key={data.month}
                  className="border-b last:border-0 pb-4 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">{data.month}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{data.fairnessScore}</span>
                      <span className="text-sm text-gray-600">점</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {/* 총 스케줄 */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">총 스케줄</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold">
                          {data.totalSchedules}
                        </span>
                        {prevData && getTrendIcon(data.totalSchedules, prevData.totalSchedules)}
                      </div>
                      {prevData && (
                        <p
                          className={`text-xs ${getTrendColor(
                            data.totalSchedules,
                            prevData.totalSchedules
                          )}`}
                        >
                          {getPercentageChange(
                            data.totalSchedules,
                            prevData.totalSchedules
                          ).toFixed(1)}
                          %
                        </p>
                      )}
                    </div>

                    {/* 야간 근무 */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">야간 근무</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold">
                          {data.nightShiftCount}
                        </span>
                        {prevData && getTrendIcon(data.nightShiftCount, prevData.nightShiftCount)}
                      </div>
                      {prevData && (
                        <p
                          className={`text-xs ${getTrendColor(
                            data.nightShiftCount,
                            prevData.nightShiftCount
                          )}`}
                        >
                          {getPercentageChange(
                            data.nightShiftCount,
                            prevData.nightShiftCount
                          ).toFixed(1)}
                          %
                        </p>
                      )}
                    </div>

                    {/* 주말 근무 */}
                    <div>
                      <p className="text-sm text-gray-600 mb-1">주말 근무</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold">
                          {data.weekendShiftCount}
                        </span>
                        {prevData && getTrendIcon(data.weekendShiftCount, prevData.weekendShiftCount)}
                      </div>
                      {prevData && (
                        <p
                          className={`text-xs ${getTrendColor(
                            data.weekendShiftCount,
                            prevData.weekendShiftCount
                          )}`}
                        >
                          {getPercentageChange(
                            data.weekendShiftCount,
                            prevData.weekendShiftCount
                          ).toFixed(1)}
                          %
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 형평성 점수 바 */}
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${data.fairnessScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 평균 형평성 점수 */}
      <Card>
        <CardHeader>
          <CardTitle>평균 형평성 점수 (최근 6개월)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-5xl font-bold text-blue-600">
              {(
                monthlyTrend.reduce((sum, data) => sum + data.fairnessScore, 0) /
                monthlyTrend.length
              ).toFixed(1)}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              최근 {monthlyTrend.length}개월 평균 형평성 점수
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
