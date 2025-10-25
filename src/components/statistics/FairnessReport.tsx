'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Scale, AlertCircle, CheckCircle } from 'lucide-react'
import { useStatistics } from '@/lib/hooks/use-statistics'

interface FairnessReportProps {
  year: number
  month: number
}

export function FairnessReport({ year, month }: FairnessReportProps) {
  const { staffWorkload, isLoadingWorkload } = useStatistics(year, month)

  if (isLoadingWorkload) {
    return <p className="text-center py-8">로딩 중...</p>
  }

  if (!staffWorkload || staffWorkload.length === 0) {
    return <p className="text-center py-8">형평성 데이터가 없습니다</p>
  }

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

  const avgFairness =
    staffWorkload.reduce((sum, staff) => sum + staff.fairnessScore, 0) /
    staffWorkload.length

  const excellentCount = staffWorkload.filter((s) => s.grade === 'EXCELLENT').length
  const poorCount = staffWorkload.filter((s) => s.grade === 'POOR').length

  return (
    <div className="space-y-6">
      {/* 형평성 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Scale className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">평균 형평성 점수</p>
              <p className="text-3xl font-bold">{avgFairness.toFixed(1)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">우수 등급</p>
              <p className="text-3xl font-bold text-green-600">
                {excellentCount}명
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">미흡 등급</p>
              <p className="text-3xl font-bold text-red-600">{poorCount}명</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 직원별 형평성 상세 */}
      <Card>
        <CardHeader>
          <CardTitle>직원별 형평성 점수</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {staffWorkload
              .sort((a, b) => b.fairnessScore - a.fairnessScore)
              .map((staff) => (
                <div
                  key={staff.staffId}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-lg">{staff.staffName}</span>
                      <Badge variant="outline">{staff.rank}</Badge>
                      <Badge variant={getGradeBadgeVariant(staff.grade)}>
                        {getGradeLabel(staff.grade)}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{staff.fairnessScore}</span>
                      <span className="text-sm text-gray-600 ml-1">점</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">총 근무</p>
                      <p className="font-semibold">{staff.totalShifts}회</p>
                    </div>
                    <div>
                      <p className="text-gray-600">야간 근무</p>
                      <p className="font-semibold">{staff.nightShifts}회</p>
                    </div>
                    <div>
                      <p className="text-gray-600">주말 근무</p>
                      <p className="font-semibold">{staff.weekendShifts}회</p>
                    </div>
                  </div>

                  {/* 형평성 점수 바 */}
                  <div className="mt-3">
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
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
