/**
 * Admin 형평성 모니터링 인터페이스
 * 경로: /fairness/monitoring
 *
 * 기능:
 * - 전체 직원 형평성 히트맵
 * - 카테고리별 비교
 * - 월별 추이 차트
 * - 경고 알림 (불균형 직원)
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Users, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface StaffFairness {
  staffId: string
  staffName: string
  categoryName: string
  departmentName: string
  dimensions: {
    total: { actual: number; baseline: number; deviation: number; status: string }
    night: { actual: number; baseline: number; deviation: number; status: string }
    weekend: { actual: number; baseline: number; deviation: number; status: string }
    holiday: { actual: number; baseline: number; deviation: number; status: string }
    holidayAdjacent: { actual: number; baseline: number; deviation: number; status: string }
  }
}

interface CategoryStats {
  categoryName: string
  staffCount: number
  avgTotal: number
  avgNight: number
  avgWeekend: number
  avgHoliday: number
  avgHolidayAdjacent: number
}

export default function FairnessMonitoringPage() {
  const { toast } = useToast()
  const [staffFairness, setStaffFairness] = useState<StaffFairness[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [useHolidayFairness, setUseHolidayFairness] = useState(false)

  useEffect(() => {
    fetchFairnessData()
  }, [])

  const fetchFairnessData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/fairness/monitoring')
      const data = await response.json()

      if (data.success) {
        setStaffFairness(data.staffFairness || [])
        setCategoryStats(data.categoryStats || [])
        setUseHolidayFairness(data.useHolidayFairness || false)
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: data.error
        })
      }
    } catch (error) {
      console.error('Failed to fetch fairness data:', error)
      toast({
        variant: 'destructive',
        title: '오류',
        description: '형평성 데이터를 불러올 수 없습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const getDeviationColor = (deviation: number) => {
    // 편차: 양수 = 덜 일함 (부족), 음수 = 많이 일함 (과다)
    if (deviation >= 3) return 'bg-blue-500' // 크게 부족
    if (deviation >= 1) return 'bg-green-500' // 약간 부족
    if (deviation >= -1) return 'bg-gray-400' // 균형
    if (deviation >= -3) return 'bg-yellow-500' // 약간 과다
    return 'bg-red-500' // 크게 과다
  }

  const getDeviationTextColor = (deviation: number) => {
    if (deviation >= 3) return 'text-blue-600'
    if (deviation >= 1) return 'text-green-600'
    if (deviation >= -1) return 'text-gray-600'
    if (deviation >= -3) return 'text-yellow-600'
    return 'text-red-600'
  }

  const filteredStaff = selectedCategory === 'ALL'
    ? staffFairness
    : staffFairness.filter(s => s.categoryName === selectedCategory)

  // 경고: 야간/주말 편차가 -3 이하 또는 3 이상인 직원
  const warningStaff = staffFairness.filter(s =>
    Math.abs(s.dimensions.night.deviation) >= 3 ||
    Math.abs(s.dimensions.weekend.deviation) >= 3
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">형평성 데이터 로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">형평성 모니터링</h1>
          <p className="text-gray-600 mt-1">자동배치 대상 직원의 누적 편차 현황</p>
        </div>

        <Button onClick={fetchFairnessData} variant="outline">
          새로고침
        </Button>
      </div>

      {/* 경고 알림 */}
      {warningStaff.length > 0 && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-5 h-5" />
              불균형 경고 ({warningStaff.length}명)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {warningStaff.map(staff => (
                <div
                  key={staff.staffId}
                  className="flex items-center justify-between p-3 bg-white rounded border"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-medium">{staff.staffName}</div>
                    <Badge variant="outline">{staff.categoryName}</Badge>
                    <Badge variant="outline" className="text-xs">{staff.departmentName}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">야간: </span>
                      <span className={`font-bold ${getDeviationTextColor(staff.dimensions.night.deviation)}`}>
                        {staff.dimensions.night.deviation > 0 ? '+' : ''}{staff.dimensions.night.deviation.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">주말: </span>
                      <span className={`font-bold ${getDeviationTextColor(staff.dimensions.weekend.deviation)}`}>
                        {staff.dimensions.weekend.deviation > 0 ? '+' : ''}{staff.dimensions.weekend.deviation.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 카테고리 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categoryStats.map(cat => (
          <Card key={cat.categoryName}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                {cat.categoryName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xs text-gray-500 mb-2">
                  총 {cat.staffCount}명 평균 편차
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">전체</div>
                    <div className={`font-bold ${getDeviationTextColor(cat.avgTotal)}`}>
                      {cat.avgTotal > 0 ? '+' : ''}{cat.avgTotal}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">야간</div>
                    <div className={`font-bold ${getDeviationTextColor(cat.avgNight)}`}>
                      {cat.avgNight > 0 ? '+' : ''}{cat.avgNight}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">주말</div>
                    <div className={`font-bold ${getDeviationTextColor(cat.avgWeekend)}`}>
                      {cat.avgWeekend > 0 ? '+' : ''}{cat.avgWeekend}
                    </div>
                  </div>
                  {useHolidayFairness && (
                    <>
                      <div>
                        <div className="text-gray-500">공휴일</div>
                        <div className={`font-bold ${getDeviationTextColor(cat.avgHoliday)}`}>
                          {cat.avgHoliday > 0 ? '+' : ''}{cat.avgHoliday}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">인접</div>
                        <div className={`font-bold ${getDeviationTextColor(cat.avgHolidayAdjacent)}`}>
                          {cat.avgHolidayAdjacent > 0 ? '+' : ''}{cat.avgHolidayAdjacent}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 히트맵 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              형평성 히트맵
            </CardTitle>
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 카테고리</SelectItem>
                {categoryStats.map(cat => (
                  <SelectItem key={cat.categoryName} value={cat.categoryName}>
                    {cat.categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStaff.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>데이터가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 범례 */}
              <div className="flex items-center gap-4 text-sm text-gray-600 pb-3 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>크게 과다 (≤-3)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>약간 과다 (-3~-1)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-400 rounded"></div>
                  <span>균형 (-1~1)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>약간 부족 (1~3)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span>크게 부족 (≥3)</span>
                </div>
              </div>

              {/* 히트맵 그리드 */}
              <div className="grid grid-cols-1 gap-2">
                {filteredStaff.map(staff => (
                  <div
                    key={staff.staffId}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    {/* 직원 정보 */}
                    <div className="w-40 flex-shrink-0">
                      <div className="font-medium">{staff.staffName}</div>
                      <div className="text-xs text-gray-500">{staff.categoryName}</div>
                      <div className="text-xs text-gray-400">{staff.departmentName}</div>
                    </div>

                    {/* 차원별 편차 바 */}
                    <div className={`flex-1 grid ${useHolidayFairness ? 'grid-cols-5' : 'grid-cols-3'} gap-2`}>
                      {Object.entries(staff.dimensions)
                        .filter(([key]) => key === 'total' || key === 'night' || key === 'weekend' || (useHolidayFairness && (key === 'holiday' || key === 'holidayAdjacent')))
                        .map(([key, dim]) => (
                          <div key={key} className="text-center">
                            <div
                              className={`h-8 rounded flex items-center justify-center text-white text-sm font-bold ${getDeviationColor(dim.deviation)}`}
                            >
                              {dim.deviation > 0 ? '+' : ''}{dim.deviation.toFixed(1)}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {key === 'total' && '전체'}
                              {key === 'night' && '야간'}
                              {key === 'weekend' && '주말'}
                              {key === 'holiday' && '공휴일'}
                              {key === 'holidayAdjacent' && '인접'}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 안내 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="font-bold text-blue-900 mb-3">📊 형평성 모니터링 가이드</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>편차</strong>: 누적 형평성 편차 (양수: 부족, 음수: 과다)</p>
            <p>• <strong>파란색 (≥3)</strong>: 크게 부족 - 근무 배정 필요</p>
            <p>• <strong>초록색 (1~3)</strong>: 약간 부족 - 정상 범위</p>
            <p>• <strong>회색 (-1~1)</strong>: 균형 잡힘 - 이상적 상태</p>
            <p>• <strong>노란색 (-3~-1)</strong>: 약간 과다 - 주의 필요</p>
            <p>• <strong>빨간색 (≤-3)</strong>: 크게 과다 - 조정 필요</p>
            <p>• 야간/주말 편차가 ±3 이상인 직원은 경고 알림에 표시됩니다</p>
            <p>• Staff 테이블에 저장된 누적 편차를 실시간 조회합니다</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
