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
import { TrendingUp, TrendingDown, AlertTriangle, Users, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface StaffFairness {
  staffId: string
  staffName: string
  categoryName: string
  overallScore: number
  dimensions: {
    night: { score: number; status: string }
    weekend: { score: number; status: string }
    holiday: { score: number; status: string }
    holidayAdjacent: { score: number; status: string }
  }
}

interface CategoryStats {
  categoryName: string
  averageScore: number
  staffCount: number
  minScore: number
  maxScore: number
}

export default function FairnessMonitoringPage() {
  const { toast } = useToast()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [staffFairness, setStaffFairness] = useState<StaffFairness[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')

  useEffect(() => {
    fetchFairnessData()
  }, [selectedYear, selectedMonth])

  const fetchFairnessData = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/fairness/monitoring?year=${selectedYear}&month=${selectedMonth}`
      )
      const data = await response.json()

      if (data.success) {
        setStaffFairness(data.staffFairness || [])
        setCategoryStats(data.categoryStats || [])
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-red-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-green-500'
    if (score >= 20) return 'bg-blue-500'
    return 'bg-gray-500'
  }

  const getScoreTextColor = (score: number) => {
    if (score >= 80) return 'text-red-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-green-600'
    if (score >= 20) return 'text-blue-600'
    return 'text-gray-600'
  }

  const filteredStaff = selectedCategory === 'ALL'
    ? staffFairness
    : staffFairness.filter(s => s.categoryName === selectedCategory)

  const warningStaff = staffFairness.filter(s => s.overallScore < 30 || s.overallScore > 80)

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
          <p className="text-gray-600 mt-1">전체 직원 형평성 현황 및 분석</p>
        </div>

        {/* 월 선택 */}
        <div className="flex items-center gap-3">
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => setSelectedMonth(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <SelectItem key={month} value={month.toString()}>
                  {month}월
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={fetchFairnessData} variant="outline">
            새로고침
          </Button>
        </div>
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
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`text-lg font-bold ${getScoreTextColor(staff.overallScore)}`}>
                      {staff.overallScore}점
                    </div>
                    {staff.overallScore < 30 && (
                      <Badge className="bg-blue-500">근무 부족</Badge>
                    )}
                    {staff.overallScore > 80 && (
                      <Badge className="bg-red-500">근무 과다</Badge>
                    )}
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
                <div className="flex items-end gap-2">
                  <div className="text-3xl font-bold">{cat.averageScore}</div>
                  <div className="text-sm text-gray-500 mb-1">평균</div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div>최소: {cat.minScore}점</div>
                  <div>최대: {cat.maxScore}점</div>
                </div>
                <div className="text-xs text-gray-500">
                  총 {cat.staffCount}명
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
                  <div className="w-4 h-4 bg-gray-500 rounded"></div>
                  <span>0-20</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span>20-40</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>40-60</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>60-80</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>80-100</span>
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
                    </div>

                    {/* 종합 점수 */}
                    <div className="w-20 flex-shrink-0 text-center">
                      <div className={`text-xl font-bold ${getScoreTextColor(staff.overallScore)}`}>
                        {staff.overallScore}
                      </div>
                      <div className="text-xs text-gray-500">종합</div>
                    </div>

                    {/* 차원별 점수 바 */}
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      {Object.entries(staff.dimensions).map(([key, dim]) => (
                        <div key={key} className="text-center">
                          <div
                            className={`h-8 rounded flex items-center justify-center text-white text-sm font-bold ${getScoreColor(dim.score)}`}
                          >
                            {dim.score}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
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
            <p>• <strong>점수가 낮을수록</strong> (파란색) 근무가 적어 연차/오프 신청이 어렵습니다</p>
            <p>• <strong>점수가 높을수록</strong> (빨간색) 근무가 많아 형평성이 좋습니다</p>
            <p>• 30점 미만 또는 80점 초과 시 경고 알림이 표시됩니다</p>
            <p>• 카테고리별로 평균을 비교하여 불균형을 확인하세요</p>
            <p>• 히트맵에서 차원별(야간/주말/공휴일/인접) 세부 점수를 확인할 수 있습니다</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
