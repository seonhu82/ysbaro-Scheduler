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
  totalWorkDays: number
  totalOffDays: number
  annualLeaveDays: number
  fairnessScore: number
  averageScore: number
}

export default function MyFairnessPage({
  params,
}: {
  params: { token: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [fairnessData, setFairnessData] = useState<FairnessData[]>([])
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

  const getScoreIcon = (myScore: number, avgScore: number) => {
    const diff = myScore - avgScore
    if (diff > 0.5) {
      return <TrendingUp className="w-5 h-5 text-green-600" />
    } else if (diff < -0.5) {
      return <TrendingDown className="w-5 h-5 text-red-600" />
    } else {
      return <Minus className="w-5 h-5 text-gray-600" />
    }
  }

  const getScoreColor = (myScore: number, avgScore: number) => {
    const diff = myScore - avgScore
    if (diff > 0.5) {
      return 'text-green-600'
    } else if (diff < -0.5) {
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
            <strong>형평성 점수란?</strong> 근무 일수와 휴무 일수를 고려하여 공정한 스케줄 배분을 위해 계산되는 점수입니다.
            평균보다 높으면 더 많이 근무한 것이고, 낮으면 더 적게 근무한 것입니다.
          </p>
        </CardContent>
      </Card>

      {/* 형평성 데이터 */}
      {fairnessData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">형평성 데이터가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {fairnessData.map((data, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {data.year}년 {data.month}월
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">근무일</p>
                    <p className="text-2xl font-bold text-blue-600">{data.totalWorkDays}</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">오프</p>
                    <p className="text-2xl font-bold text-amber-600">{data.totalOffDays}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">연차</p>
                    <p className="text-2xl font-bold text-green-600">{data.annualLeaveDays}</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">총 휴무</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {data.totalOffDays + data.annualLeaveDays}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">내 형평성 점수</span>
                    <div className="flex items-center gap-2">
                      {getScoreIcon(data.fairnessScore, data.averageScore)}
                      <span className={`text-2xl font-bold ${getScoreColor(data.fairnessScore, data.averageScore)}`}>
                        {data.fairnessScore.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">부서 평균</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {data.averageScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>평균 대비</span>
                      <span className={getScoreColor(data.fairnessScore, data.averageScore)}>
                        {data.fairnessScore > data.averageScore ? '+' : ''}
                        {(data.fairnessScore - data.averageScore).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
