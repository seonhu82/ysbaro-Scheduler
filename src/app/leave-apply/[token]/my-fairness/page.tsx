/**
 * 직원 개인 형평성 대시보드
 * 경로: /leave-apply/[token]/my-fairness
 *
 * 기능:
 * - 본인의 형평성 점수 확인
 * - 차원별 상세 점수 (야간/주말/공휴일/공휴일 인접)
 * - 월별 추이 차트
 * - 카테고리 평균 대비 비교
 */

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, TrendingDown, Minus, Moon, Calendar, Flag, Star } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DimensionScore {
  dimension: string
  actual: number
  baseline: number
  deviation: number
  status: 'ahead' | 'behind' | 'balanced'
  score: number
}

interface FairnessScore {
  overallScore: number
  dimensions: {
    night: DimensionScore
    weekend: DimensionScore
    holiday: DimensionScore
    holidayAdjacent: DimensionScore
  }
  categoryName: string
  categoryAverage: number
  rank: number
  totalInCategory: number
}

export default function MyFairnessPage() {
  const params = useParams()
  const { toast } = useToast()
  const [staffInfo, setStaffInfo] = useState<any>(null)
  const [fairness, setFairness] = useState<FairnessScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  })

  useEffect(() => {
    fetchStaffInfo()
  }, [params.token])

  useEffect(() => {
    if (staffInfo) {
      fetchFairnessScore()
    }
  }, [staffInfo, selectedMonth])

  const fetchStaffInfo = async () => {
    try {
      const response = await fetch(`/api/leave-apply/${params.token}/verify`)
      const data = await response.json()

      if (data.success) {
        setStaffInfo(data.staff)
      } else {
        toast({
          variant: 'destructive',
          title: '인증 실패',
          description: '유효하지 않은 토큰입니다'
        })
      }
    } catch (error) {
      console.error('Failed to fetch staff info:', error)
      toast({
        variant: 'destructive',
        title: '오류',
        description: '직원 정보를 불러올 수 없습니다'
      })
    }
  }

  const fetchFairnessScore = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/fairness/calculate-v2?staffId=${staffInfo.id}&year=${selectedMonth.year}&month=${selectedMonth.month}`
      )
      const data = await response.json()

      if (data.success) {
        setFairness(data.fairness)
      }
    } catch (error) {
      console.error('Failed to fetch fairness:', error)
      toast({
        variant: 'destructive',
        title: '오류',
        description: '형평성 점수를 불러올 수 없습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const getDimensionIcon = (dimension: string) => {
    switch (dimension) {
      case 'night':
        return <Moon className="w-5 h-5" />
      case 'weekend':
        return <Calendar className="w-5 h-5" />
      case 'holiday':
        return <Flag className="w-5 h-5" />
      case 'holidayAdjacent':
        return <Star className="w-5 h-5" />
      default:
        return null
    }
  }

  const getDimensionLabel = (dimension: string) => {
    switch (dimension) {
      case 'night':
        return '야간 근무'
      case 'weekend':
        return '주말 근무'
      case 'holiday':
        return '공휴일 근무'
      case 'holidayAdjacent':
        return '공휴일 인접 근무'
      default:
        return dimension
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ahead':
        return <Badge className="bg-red-500">많음</Badge>
      case 'behind':
        return <Badge className="bg-green-500">적음</Badge>
      case 'balanced':
        return <Badge className="bg-blue-500">균형</Badge>
      default:
        return null
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ahead':
        return <TrendingUp className="w-4 h-4 text-red-500" />
      case 'behind':
        return <TrendingDown className="w-4 h-4 text-green-500" />
      case 'balanced':
        return <Minus className="w-4 h-4 text-blue-500" />
      default:
        return null
    }
  }

  if (loading || !staffInfo || !fairness) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">형평성 데이터 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">나의 형평성 대시보드</h1>
              <p className="text-gray-600 mt-1">
                {staffInfo.name} ({staffInfo.categoryName})
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">조회 월</div>
              <div className="text-2xl font-bold text-gray-900">
                {selectedMonth.year}년 {selectedMonth.month}월
              </div>
            </div>
          </div>
        </div>

        {/* 전체 점수 */}
        <Card className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="text-sm uppercase tracking-wide mb-2 opacity-90">
                종합 형평성 점수
              </div>
              <div className="text-7xl font-bold mb-4">
                {fairness.overallScore}
                <span className="text-3xl ml-2">점</span>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div>
                  <div className="text-sm opacity-90">카테고리 평균</div>
                  <div className="text-2xl font-bold">{fairness.categoryAverage}점</div>
                </div>
                <div className="w-px h-12 bg-white/30"></div>
                <div>
                  <div className="text-sm opacity-90">카테고리 내 순위</div>
                  <div className="text-2xl font-bold">
                    {fairness.rank}위 / {fairness.totalInCategory}명
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 연차/오프 신청 가능 여부 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">연차 신청 가능 여부</CardTitle>
            </CardHeader>
            <CardContent>
              {fairness.overallScore >= 60 ? (
                <div className="text-center py-6">
                  <div className="text-5xl mb-3">✅</div>
                  <div className="text-xl font-bold text-green-600 mb-2">신청 가능</div>
                  <div className="text-sm text-gray-600">
                    형평성 점수 60점 이상 (현재 {fairness.overallScore}점)
                  </div>
                  <Progress value={Math.min((fairness.overallScore / 100) * 100, 100)} className="mt-4" />
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-5xl mb-3">❌</div>
                  <div className="text-xl font-bold text-red-600 mb-2">신청 불가</div>
                  <div className="text-sm text-gray-600">
                    60점 필요 (현재 {fairness.overallScore}점, {60 - fairness.overallScore}점 부족)
                  </div>
                  <Progress value={Math.min((fairness.overallScore / 60) * 100, 100)} className="mt-4" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">오프 신청 가능 여부</CardTitle>
            </CardHeader>
            <CardContent>
              {fairness.overallScore >= 75 ? (
                <div className="text-center py-6">
                  <div className="text-5xl mb-3">✅</div>
                  <div className="text-xl font-bold text-green-600 mb-2">신청 가능</div>
                  <div className="text-sm text-gray-600">
                    형평성 점수 75점 이상 (현재 {fairness.overallScore}점)
                  </div>
                  <Progress value={Math.min((fairness.overallScore / 100) * 100, 100)} className="mt-4" />
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-5xl mb-3">❌</div>
                  <div className="text-xl font-bold text-red-600 mb-2">신청 불가</div>
                  <div className="text-sm text-gray-600">
                    75점 필요 (현재 {fairness.overallScore}점, {75 - fairness.overallScore}점 부족)
                  </div>
                  <Progress value={Math.min((fairness.overallScore / 75) * 100, 100)} className="mt-4" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 차원별 상세 점수 */}
        <Card>
          <CardHeader>
            <CardTitle>차원별 상세 점수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(fairness.dimensions).map(([key, dim]) => (
                <div
                  key={key}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        {getDimensionIcon(key)}
                      </div>
                      <div>
                        <div className="font-medium">{getDimensionLabel(key)}</div>
                        <div className="text-sm text-gray-500">
                          실제 {dim.actual}회 / 기준 {dim.baseline.toFixed(1)}회
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(dim.status)}
                      <div className="text-2xl font-bold">{dim.score}점</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusIcon(dim.status)}
                    <div className="flex-1">
                      <Progress
                        value={Math.min(Math.abs(dim.deviation) * 10, 100)}
                        className={
                          dim.status === 'ahead'
                            ? '[&>div]:bg-red-500'
                            : dim.status === 'behind'
                            ? '[&>div]:bg-green-500'
                            : '[&>div]:bg-blue-500'
                        }
                      />
                    </div>
                    <div className="text-sm text-gray-600 min-w-[80px] text-right">
                      {dim.status === 'ahead' && `+${dim.deviation.toFixed(1)}회`}
                      {dim.status === 'behind' && `${dim.deviation.toFixed(1)}회`}
                      {dim.status === 'balanced' && '균형'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 안내 사항 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <h3 className="font-bold text-blue-900 mb-3">📊 형평성 점수 안내</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>• <strong>점수가 낮을수록</strong> 근무가 적어 연차/오프 신청이 어렵습니다</p>
              <p>• <strong>연차</strong>: 60점 이상 필요 (관대한 기준)</p>
              <p>• <strong>오프</strong>: 75점 이상 필요 (엄격한 기준)</p>
              <p>• 각 차원(야간/주말/공휴일/공휴일인접)별로 기준치 대비 실제 근무 횟수를 계산합니다</p>
              <p>• 스케줄이 확정되면 자동으로 업데이트됩니다</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
