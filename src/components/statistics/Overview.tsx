'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Users,
  Moon,
  CalendarRange,
  TrendingUp,
  Scale
} from 'lucide-react'
import { useStatistics } from '@/lib/hooks/use-statistics'

interface OverviewProps {
  year: number
  month: number
}

export function Overview({ year, month }: OverviewProps) {
  const { monthlyStats, isLoadingMonthly } = useStatistics(year, month)

  if (isLoadingMonthly) {
    return <p className="text-center py-8">로딩 중...</p>
  }

  if (!monthlyStats) {
    return <p className="text-center py-8">통계 데이터가 없습니다</p>
  }

  const stats = [
    {
      title: '전체 스케줄',
      value: monthlyStats.totalSchedules,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: '총 배치 인원',
      value: monthlyStats.totalAssignments,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: '야간 근무',
      value: monthlyStats.nightShiftCount,
      icon: Moon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: '주말 근무',
      value: monthlyStats.weekendShiftCount,
      icon: CalendarRange,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
  ]

  const getGradeBadgeVariant = (score: number) => {
    if (score >= 90) return 'default'
    if (score >= 75) return 'secondary'
    if (score >= 60) return 'outline'
    return 'destructive'
  }

  const getGradeLabel = (score: number) => {
    if (score >= 90) return '우수'
    if (score >= 75) return '양호'
    if (score >= 60) return '보통'
    return '미흡'
  }

  return (
    <div className="space-y-6">
      {/* 주요 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 형평성 점수 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5" />
            형평성 점수
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-5xl font-bold">{monthlyStats.fairnessScore}</span>
                <Badge variant={getGradeBadgeVariant(monthlyStats.fairnessScore)}>
                  {getGradeLabel(monthlyStats.fairnessScore)}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                100점 만점 기준 형평성 점수
              </p>
            </div>
            <div className="text-right">
              <TrendingUp className="w-12 h-12 text-green-600" />
            </div>
          </div>

          {/* 형평성 점수 바 */}
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${monthlyStats.fairnessScore}%`,
                  backgroundColor:
                    monthlyStats.fairnessScore >= 90
                      ? '#22c55e'
                      : monthlyStats.fairnessScore >= 75
                      ? '#3b82f6'
                      : monthlyStats.fairnessScore >= 60
                      ? '#f59e0b'
                      : '#ef4444'
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 평균 일일 배치 인원 */}
      <Card>
        <CardHeader>
          <CardTitle>평균 일일 배치 인원</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600">
              {monthlyStats.avgStaffPerDay.toFixed(1)}명
            </p>
            <p className="text-sm text-gray-600 mt-2">
              하루 평균 {monthlyStats.avgStaffPerDay.toFixed(1)}명의 직원이 배치되었습니다
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 직급별 배치 현황 */}
      {monthlyStats.byRank && Object.keys(monthlyStats.byRank).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>직급별 배치 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(monthlyStats.byRank).map(([rank, data]) => (
                <div key={rank}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{rank}</span>
                    <span className="text-sm text-gray-600">
                      {data.count}회 ({data.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${data.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
