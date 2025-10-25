'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, TrendingUp } from 'lucide-react'
import { useStatistics } from '@/lib/hooks/use-statistics'

interface StaffWorkloadProps {
  year: number
  month: number
}

export function StaffWorkload({ year, month }: StaffWorkloadProps) {
  const { staffWorkload, isLoadingWorkload } = useStatistics(year, month)

  if (isLoadingWorkload) {
    return <p className="text-center py-8">로딩 중...</p>
  }

  if (!staffWorkload || staffWorkload.length === 0) {
    return <p className="text-center py-8">직원 업무량 데이터가 없습니다</p>
  }

  // 총 근무 기준으로 정렬
  const sortedByTotal = [...staffWorkload].sort((a, b) => b.totalShifts - a.totalShifts)

  // 야간 근무 상위 5명
  const topNightShifts = [...staffWorkload]
    .sort((a, b) => b.nightShifts - a.nightShifts)
    .slice(0, 5)

  // 주말 근무 상위 5명
  const topWeekendShifts = [...staffWorkload]
    .sort((a, b) => b.weekendShifts - a.weekendShifts)
    .slice(0, 5)

  const avgTotalShifts =
    staffWorkload.reduce((sum, staff) => sum + staff.totalShifts, 0) /
    staffWorkload.length

  const avgNightShifts =
    staffWorkload.reduce((sum, staff) => sum + staff.nightShifts, 0) /
    staffWorkload.length

  const avgWeekendShifts =
    staffWorkload.reduce((sum, staff) => sum + staff.weekendShifts, 0) /
    staffWorkload.length

  return (
    <div className="space-y-6">
      {/* 평균 업무량 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">평균 총 근무</p>
              <p className="text-3xl font-bold">{avgTotalShifts.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-1">회</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">평균 야간 근무</p>
              <p className="text-3xl font-bold">{avgNightShifts.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-1">회</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">평균 주말 근무</p>
              <p className="text-3xl font-bold">{avgWeekendShifts.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-1">회</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 전체 직원 업무량 */}
      <Card>
        <CardHeader>
          <CardTitle>전체 직원 업무량</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedByTotal.map((staff, index) => (
              <div
                key={staff.staffId}
                className="border rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {index < 3 && (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0
                            ? 'bg-yellow-500'
                            : index === 1
                            ? 'bg-gray-400'
                            : 'bg-amber-700'
                        }`}
                      >
                        {index + 1}
                      </div>
                    )}
                    <span className="font-semibold">{staff.staffName}</span>
                    <Badge variant="outline">{staff.rank}</Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold">{staff.totalShifts}</span>
                    <span className="text-sm text-gray-600 ml-1">회</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">야간 근무</p>
                    <p className="font-semibold">{staff.nightShifts}회</p>
                  </div>
                  <div>
                    <p className="text-gray-600">주말 근무</p>
                    <p className="font-semibold">{staff.weekendShifts}회</p>
                  </div>
                </div>

                {/* 업무량 바 */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${(staff.totalShifts / sortedByTotal[0].totalShifts) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 야간 근무 상위 5명 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            야간 근무 상위 5명
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topNightShifts.map((staff, index) => (
              <div
                key={staff.staffId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400">{index + 1}</span>
                  <span className="font-medium">{staff.staffName}</span>
                  <Badge variant="outline" className="text-xs">
                    {staff.rank}
                  </Badge>
                </div>
                <span className="font-bold text-purple-600">{staff.nightShifts}회</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 주말 근무 상위 5명 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            주말 근무 상위 5명
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topWeekendShifts.map((staff, index) => (
              <div
                key={staff.staffId}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400">{index + 1}</span>
                  <span className="font-medium">{staff.staffName}</span>
                  <Badge variant="outline" className="text-xs">
                    {staff.rank}
                  </Badge>
                </div>
                <span className="font-bold text-orange-600">{staff.weekendShifts}회</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
