/**
 * 형평성 체크 컴포넌트
 * 공개 연차/오프 신청 페이지에서 사용
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Loader2, Calendar, Moon, Coffee, TrendingUp } from 'lucide-react'

interface FairnessCheckProps {
  token: string
  staffId: string
  startDate: Date
  endDate: Date
}

interface FairnessScores {
  totalDays: number
  night: number
  weekend: number
  holiday: number
  holidayAdjacent: number
}

interface MonthlyStats {
  workingDays: number
  appliedOffs: number
  maxAllowedDays: number
  remainingDays: number
  avgFairnessScore: number
  myFairnessScore: number
}

interface FairnessData {
  staffName: string
  targetMonth: string
  fairnessScores: FairnessScores
  monthlyStats: MonthlyStats
  fairnessSettings: {
    enableNightShift: boolean
    enableWeekend: boolean
    enableHoliday: boolean
    enableHolidayAdjacent: boolean
  } | null
}

export default function FairnessCheck({ token, staffId, startDate, endDate }: FairnessCheckProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FairnessData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadFairnessData = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({ staffId })
        const response = await fetch(`/api/leave-apply/${token}/fairness?${params}`)
        const result = await response.json()

        if (result.success) {
          setData(result.data)
        } else {
          throw new Error(result.error)
        }
      } catch (err: any) {
        setError(err.message || '형평성 확인 중 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }

    if (token && staffId) {
      loadFairnessData()
    }
  }, [token, staffId])

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>형평성 확인 중...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <Info className="w-4 h-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return null
  }

  const canApply = data.monthlyStats.remainingDays > 0

  return (
    <Card className={canApply ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">형평성 확인 ({data.targetMonth})</CardTitle>
          <Badge variant={canApply ? 'default' : 'secondary'} className="gap-1">
            {canApply ? (
              <>
                <TrendingUp className="w-3 h-3" />
                신청 가능 {data.monthlyStats.remainingDays}일
              </>
            ) : (
              <>
                <Info className="w-3 h-3" />
                신청 불가
              </>
            )}
          </Badge>
        </div>
        <CardDescription className={canApply ? 'text-green-700' : 'text-yellow-700'}>
          {canApply
            ? `11월 최대 ${data.monthlyStats.maxAllowedDays}일 신청 가능 (${data.monthlyStats.appliedOffs}일 신청 완료)`
            : '11월 신청 가능한 일수를 모두 사용하셨습니다'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 형평성 점수 현황 */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-sm">형평성 점수 현황</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Calendar className="w-4 h-4 text-gray-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-500">총 근무일</div>
                <div className="font-semibold text-sm">{data.fairnessScores.totalDays.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Moon className="w-4 h-4 text-indigo-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-500">야근</div>
                <div className="font-semibold text-sm">{data.fairnessScores.night.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Coffee className="w-4 h-4 text-orange-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-500">주말 근무</div>
                <div className="font-semibold text-sm">{data.fairnessScores.weekend.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Calendar className="w-4 h-4 text-red-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-500">공휴일</div>
                <div className="font-semibold text-sm">{data.fairnessScores.holiday.toFixed(2)}</div>
              </div>
            </div>
            {data.fairnessScores.holidayAdjacent > 0 && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded col-span-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <div className="flex-1">
                  <div className="text-xs text-gray-500">공휴 연장</div>
                  <div className="font-semibold text-sm">{data.fairnessScores.holidayAdjacent.toFixed(2)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 이번 달 신청 가능 일수 */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="font-medium text-sm">11월 신청 커트라인</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">11월 총 근무일</span>
              <span className="font-semibold">{data.monthlyStats.workingDays}일</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t pt-2">
              <span className="text-gray-600">{data.targetMonth} 내 형평성 점수</span>
              <span className="font-semibold text-purple-600">{data.monthlyStats.myFairnessScore}점</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">{data.targetMonth} 부서 평균 점수</span>
              <span className="font-semibold text-blue-600">{data.monthlyStats.avgFairnessScore}점</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t pt-2">
              <span className="text-gray-600">11월 최대 신청 가능</span>
              <span className="font-semibold text-blue-600">{data.monthlyStats.maxAllowedDays}일</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">11월 이미 신청함</span>
              <span className="font-semibold text-orange-600">{data.monthlyStats.appliedOffs}일</span>
            </div>
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="font-medium text-gray-900">11월 남은 신청 가능</span>
              <span className={`font-bold text-lg ${data.monthlyStats.remainingDays > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.monthlyStats.remainingDays}일
              </span>
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-sm">
            {canApply ? (
              '형평성 점수가 높을수록 더 많은 연차/오프를 신청할 수 있습니다.'
            ) : (
              '형평성 기준에 따라 이번 달 신청 가능한 일수를 모두 사용하셨습니다.'
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
