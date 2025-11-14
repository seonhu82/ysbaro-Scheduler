/**
 * 내 형평성 점수 페이지
 * 경로: /schedule-view/[token]/my-fairness
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface FairnessData {
  year: number
  month: number
  staffInfo: {
    name: string
    rank: string
  }
  fairnessSettings: {
    enableNightShiftFairness: boolean
    enableWeekendFairness: boolean
    enableHolidayFairness: boolean
    enableHolidayAdjacentFairness: boolean
  }
  currentMonth: {
    totalWork: number
    annual: number
    off: number
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
    deviation: {
      total: number
      night: number
      weekend: number
      holiday: number
      holidayAdjacent: number
    }
  }
  cumulative: {
    totalWork: number
    annual: number
    off: number
    night: number
    weekend: number
    holiday: number
    holidayAdjacent: number
    deviation: {
      total: number
      night: number
      weekend: number
      holiday: number
      holidayAdjacent: number
    }
  }
  averageDeviation: number
}

export default function MyFairnessPage({
  params,
}: {
  params: { token: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [fairnessData, setFairnessData] = useState<FairnessData | null>(null)
  const [staffName, setStaffName] = useState('')

  useEffect(() => {
    // 인증 확인
    const authData = sessionStorage.getItem(`schedule-auth-${params.token}`)
    if (!authData) {
      router.push(`/schedule-view/${params.token}`)
      return
    }

    const { staffId, staffName } = JSON.parse(authData)
    setStaffName(staffName)
    fetchFairness(staffId)
  }, [params.token, router])

  const fetchFairness = async (staffId: string) => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/public/schedule-view/${params.token}/my-fairness?staffId=${staffId}`
      )
      const data = await response.json()

      if (data.success) {
        setFairnessData(data.data)
      } else {
        toast({
          variant: 'destructive',
          title: '조회 실패',
          description: data.error || '형평성 점수를 불러올 수 없습니다'
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

  const getDeviationIcon = (deviation: number) => {
    // 양수: 평균보다 적게 근무 (좋음)
    // 음수: 평균보다 많이 근무 (나쁨)
    if (deviation > 0.5) {
      return <TrendingUp className="w-5 h-5 text-green-600" />
    } else if (deviation < -0.5) {
      return <TrendingDown className="w-5 h-5 text-red-600" />
    } else {
      return <Minus className="w-5 h-5 text-gray-600" />
    }
  }

  const getDeviationColor = (deviation: number) => {
    // 양수: 평균보다 적게 근무 (좋음)
    // 음수: 평균보다 많이 근무 (나쁨)
    if (deviation > 0) {
      return 'text-green-600'
    } else if (deviation < 0) {
      return 'text-red-600'
    } else {
      return 'text-gray-900'
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 animate-spin text-blue-500" />
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/schedule-view/${params.token}`)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          스케줄로 돌아가기
        </Button>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">내 형평성 점수</h1>
        </div>
        <p className="text-gray-600">{staffName}님의 월별 형평성 점수</p>
      </div>

      {/* 안내 */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>형평성 점수란?</strong> 근무 일수, 야간, 주말, 공휴일 근무를 고려하여 공정한 스케줄 배분을 위해 계산되는 편차 점수입니다.
            <br />
            <span className="text-green-700">• 양수(+): 평균보다 적게 근무 (근무 배치 선순위)</span> |
            <span className="text-red-700"> 음수(-): 평균보다 많이 근무 (근무 배치 후순위)</span>
            <br /><br />
            <strong>다음 달 오프 신청 제한:</strong> 편차만큼 다음 달 오프 신청이 조정됩니다.
            <br />
            예) 기본 주말 오프 가능일 3일일 때, 편차 +2이면 신청가능 1일, 편차 -1이면 신청가능 4일
          </p>
        </CardContent>
      </Card>

      {/* 형평성 데이터 */}
      {!fairnessData ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">형평성 데이터가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 누적 편차 */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100">
              <CardTitle className="text-xl font-bold text-purple-900">
                현재 편차 ({fairnessData.year}년 {fairnessData.month}월까지 누적)
              </CardTitle>
              <div className="text-sm text-purple-700">
                {fairnessData.staffInfo.name} / {fairnessData.staffInfo.rank}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* 총 근무 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm text-gray-600">총 근무</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-gray-900">{fairnessData.cumulative.totalWork}일</span>
                      <span className={`text-lg font-bold ${getDeviationColor(fairnessData.cumulative.deviation.total)}`}>
                        ({fairnessData.cumulative.deviation.total > 0 ? '+' : ''}{fairnessData.cumulative.deviation.total})
                      </span>
                    </div>
                  </div>
                </div>

                {/* 연차/오프 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs text-gray-600 mb-1">연차</p>
                    <p className="text-2xl font-bold text-green-700">{fairnessData.cumulative.annual}일</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-gray-600 mb-1">오프</p>
                    <p className="text-2xl font-bold text-amber-700">{fairnessData.cumulative.off}일</p>
                  </div>
                </div>

                {/* 세부 항목 */}
                <div className="grid grid-cols-2 gap-3">
                  {fairnessData.fairnessSettings.enableNightShiftFairness && (
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-gray-600">야간</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold">{fairnessData.cumulative.night}일</span>
                          <span className={`text-sm font-bold ${getDeviationColor(fairnessData.cumulative.deviation.night)}`}>
                            ({fairnessData.cumulative.deviation.night > 0 ? '+' : ''}{fairnessData.cumulative.deviation.night})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {fairnessData.fairnessSettings.enableWeekendFairness && (
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-gray-600">주말</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold">{fairnessData.cumulative.weekend}일</span>
                          <span className={`text-sm font-bold ${getDeviationColor(fairnessData.cumulative.deviation.weekend)}`}>
                            ({fairnessData.cumulative.deviation.weekend > 0 ? '+' : ''}{fairnessData.cumulative.deviation.weekend})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {fairnessData.fairnessSettings.enableHolidayFairness && (
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-gray-600">공휴일</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold">{fairnessData.cumulative.holiday}일</span>
                          <span className={`text-sm font-bold ${getDeviationColor(fairnessData.cumulative.deviation.holiday)}`}>
                            ({fairnessData.cumulative.deviation.holiday > 0 ? '+' : ''}{fairnessData.cumulative.deviation.holiday})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {fairnessData.fairnessSettings.enableHolidayAdjacentFairness && (
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-gray-600">공휴일 연장</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold">{fairnessData.cumulative.holidayAdjacent}일</span>
                          <span className={`text-sm font-bold ${getDeviationColor(fairnessData.cumulative.deviation.holidayAdjacent)}`}>
                            ({fairnessData.cumulative.deviation.holidayAdjacent > 0 ? '+' : ''}{fairnessData.cumulative.deviation.holidayAdjacent})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
