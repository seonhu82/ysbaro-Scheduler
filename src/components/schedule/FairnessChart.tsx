'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Scale, TrendingUp, TrendingDown } from 'lucide-react'

interface StaffFairness {
  staffId: string
  staffName: string
  rank: string
  nightShifts: number
  weekendShifts: number
  totalShifts: number
  fairnessScore: number
  grade: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'
}

interface FairnessChartProps {
  staffList: StaffFairness[]
}

export function FairnessChart({ staffList }: FairnessChartProps) {
  if (!staffList || staffList.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">형평성 데이터가 없습니다</p>
        </CardContent>
      </Card>
    )
  }

  // 평균 계산
  const avgNightShifts =
    staffList.reduce((sum, s) => sum + s.nightShifts, 0) / staffList.length
  const avgWeekendShifts =
    staffList.reduce((sum, s) => sum + s.weekendShifts, 0) / staffList.length
  const avgFairness =
    staffList.reduce((sum, s) => sum + s.fairnessScore, 0) / staffList.length

  const getGradeBadgeVariant = (grade: string) => {
    if (grade === 'EXCELLENT') return 'default'
    if (grade === 'GOOD') return 'secondary'
    if (grade === 'FAIR') return 'outline'
    return 'destructive'
  }

  const getGradeLabel = (grade: string) => {
    const labels: Record<string, string> = {
      EXCELLENT: '우수',
      GOOD: '양호',
      FAIR: '보통',
      POOR: '미흡'
    }
    return labels[grade] || grade
  }

  // 형평성 점수 기준으로 정렬
  const sortedStaff = [...staffList].sort((a, b) => b.fairnessScore - a.fairnessScore)

  return (
    <div className="space-y-4">
      {/* 평균 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5" />
            형평성 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600 mb-1">평균 형평성</p>
              <p className="text-2xl font-bold">{avgFairness.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">평균 야간 근무</p>
              <p className="text-2xl font-bold">{avgNightShifts.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">평균 주말 근무</p>
              <p className="text-2xl font-bold">{avgWeekendShifts.toFixed(1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 직원별 형평성 차트 */}
      <Card>
        <CardHeader>
          <CardTitle>직원별 형평성 점수</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedStaff.map((staff) => {
              const nightDiff = staff.nightShifts - avgNightShifts
              const weekendDiff = staff.weekendShifts - avgWeekendShifts

              return (
                <div key={staff.staffId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{staff.staffName}</span>
                      <Badge variant="outline" className="text-xs">
                        {staff.rank}
                      </Badge>
                      <Badge variant={getGradeBadgeVariant(staff.grade)} className="text-xs">
                        {getGradeLabel(staff.grade)}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold">{staff.fairnessScore}</span>
                      <span className="text-sm text-gray-600 ml-1">점</span>
                    </div>
                  </div>

                  {/* 형평성 점수 바 */}
                  <div className="mb-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${staff.fairnessScore}%`,
                          backgroundColor:
                            staff.grade === 'EXCELLENT'
                              ? '#22c55e'
                              : staff.grade === 'GOOD'
                              ? '#3b82f6'
                              : staff.grade === 'FAIR'
                              ? '#f59e0b'
                              : '#ef4444'
                        }}
                      />
                    </div>
                  </div>

                  {/* 상세 정보 */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">총 근무</p>
                      <p className="font-semibold">{staff.totalShifts}회</p>
                    </div>
                    <div>
                      <p className="text-gray-600">야간 근무</p>
                      <div className="flex items-center gap-1">
                        <p className="font-semibold">{staff.nightShifts}회</p>
                        {nightDiff > 0 ? (
                          <TrendingUp className="w-3 h-3 text-red-600" />
                        ) : nightDiff < 0 ? (
                          <TrendingDown className="w-3 h-3 text-green-600" />
                        ) : null}
                        <span
                          className={`text-xs ${
                            nightDiff > 0
                              ? 'text-red-600'
                              : nightDiff < 0
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {nightDiff > 0 ? '+' : ''}
                          {nightDiff.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-600">주말 근무</p>
                      <div className="flex items-center gap-1">
                        <p className="font-semibold">{staff.weekendShifts}회</p>
                        {weekendDiff > 0 ? (
                          <TrendingUp className="w-3 h-3 text-red-600" />
                        ) : weekendDiff < 0 ? (
                          <TrendingDown className="w-3 h-3 text-green-600" />
                        ) : null}
                        <span
                          className={`text-xs ${
                            weekendDiff > 0
                              ? 'text-red-600'
                              : weekendDiff < 0
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {weekendDiff > 0 ? '+' : ''}
                          {weekendDiff.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
