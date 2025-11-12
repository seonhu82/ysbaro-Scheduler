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

interface FairnessCutoff {
  total: number
  minRequired: number
  maxAllowed: number
}

interface FairnessCutoffs {
  totalDays: FairnessCutoff | null
  night: FairnessCutoff | null
  weekend: FairnessCutoff | null
  holiday: FairnessCutoff | null
  holidayAdjacent: FairnessCutoff | null
}

interface MonthlyStats {
  workingDays: number
  appliedOffs: number
  maxAllowedDays: number
  remainingDays: number
  avgFairnessScore: number
  myFairnessScore: number
}

interface AnnualLeave {
  total: number
  used: number
  remaining: number
}

interface FairnessData {
  staffName: string
  targetMonth: string
  fairnessScores: FairnessScores
  fairnessCutoffs: FairnessCutoffs
  monthlyStats: MonthlyStats
  annualLeave: AnnualLeave
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
            ? `${data.targetMonth} 최대 오프 ${data.monthlyStats.maxAllowedDays}일 신청 가능 (${data.monthlyStats.appliedOffs}일 신청 완료) • 연차 잔여: ${data.annualLeave.remaining}일`
            : `${data.targetMonth} 신청 가능한 오프 일수를 모두 사용하셨습니다 • 연차 잔여: ${data.annualLeave.remaining}일`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 형평성 점수 현황 - 설정에 따라 동적으로 표시 */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-sm">누적 형평성 편차 (10월까지)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* 총 근무일 - 항상 표시 */}
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <Calendar className="w-4 h-4 text-gray-600" />
              <div className="flex-1">
                <div className="text-xs text-gray-500">총 근무일</div>
                <div className="font-semibold text-sm">{data.fairnessScores.totalDays.toFixed(2)}</div>
              </div>
            </div>

            {/* 야근 - 설정에 따라 */}
            {data.fairnessSettings?.enableNightShift && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <Moon className="w-4 h-4 text-indigo-600" />
                <div className="flex-1">
                  <div className="text-xs text-gray-500">야근</div>
                  <div className="font-semibold text-sm">{data.fairnessScores.night.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* 주말 근무 - 설정에 따라 */}
            {data.fairnessSettings?.enableWeekend && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <Coffee className="w-4 h-4 text-orange-600" />
                <div className="flex-1">
                  <div className="text-xs text-gray-500">주말 근무</div>
                  <div className="font-semibold text-sm">{data.fairnessScores.weekend.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* 공휴일 - 설정에 따라 */}
            {data.fairnessSettings?.enableHoliday && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <Calendar className="w-4 h-4 text-red-600" />
                <div className="flex-1">
                  <div className="text-xs text-gray-500">공휴일</div>
                  <div className="font-semibold text-sm">{data.fairnessScores.holiday.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* 공휴 연장 - 설정에 따라 */}
            {data.fairnessSettings?.enableHolidayAdjacent && data.fairnessScores.holidayAdjacent !== 0 && (
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

        {/* 연차 잔여 일수 */}
        <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-sm text-blue-900">연차 현황</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded p-2">
              <div className="text-xs text-gray-500 mb-1">총 연차</div>
              <div className="font-semibold text-sm text-blue-600">{data.annualLeave.total}일</div>
            </div>
            <div className="bg-white rounded p-2">
              <div className="text-xs text-gray-500 mb-1">사용</div>
              <div className="font-semibold text-sm text-orange-600">{data.annualLeave.used}일</div>
            </div>
            <div className="bg-white rounded p-2">
              <div className="text-xs text-gray-500 mb-1">잔여</div>
              <div className="font-semibold text-sm text-green-600">{data.annualLeave.remaining}일</div>
            </div>
          </div>
        </div>

        {/* 형평성별 커트라인 정보 */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="font-medium text-sm">{data.targetMonth} 형평성 커트라인</span>
          </div>
          <div className="space-y-3">
            {/* 총 근무일 형평성 - 항상 표시 */}
            {data.fairnessCutoffs.totalDays && (
              <div className="p-3 bg-gray-50 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-semibold text-gray-700">총 근무일</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">전체 근무일</div>
                    <div className="font-semibold">{data.fairnessCutoffs.totalDays.total}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최소 근무</div>
                    <div className="font-semibold text-blue-600">{data.fairnessCutoffs.totalDays.minRequired}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최대 신청</div>
                    <div className="font-semibold text-green-600">{data.fairnessCutoffs.totalDays.maxAllowed}일</div>
                  </div>
                </div>
              </div>
            )}

            {/* 야간 형평성 */}
            {data.fairnessSettings?.enableNightShift && data.fairnessCutoffs.night && (
              <div className="p-3 bg-indigo-50 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-indigo-700">야간 근무</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">야간 일수</div>
                    <div className="font-semibold">{data.fairnessCutoffs.night.total}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최소 근무</div>
                    <div className="font-semibold text-blue-600">{data.fairnessCutoffs.night.minRequired}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최대 신청</div>
                    <div className="font-semibold text-green-600">{data.fairnessCutoffs.night.maxAllowed}일</div>
                  </div>
                </div>
              </div>
            )}

            {/* 주말 형평성 */}
            {data.fairnessSettings?.enableWeekend && data.fairnessCutoffs.weekend && (
              <div className="p-3 bg-orange-50 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Coffee className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-semibold text-orange-700">주말 근무</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">주말 일수</div>
                    <div className="font-semibold">{data.fairnessCutoffs.weekend.total}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최소 근무</div>
                    <div className="font-semibold text-blue-600">{data.fairnessCutoffs.weekend.minRequired}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최대 신청</div>
                    <div className="font-semibold text-green-600">{data.fairnessCutoffs.weekend.maxAllowed}일</div>
                  </div>
                </div>
              </div>
            )}

            {/* 공휴일 형평성 */}
            {data.fairnessSettings?.enableHoliday && data.fairnessCutoffs.holiday && (
              <div className="p-3 bg-red-50 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">공휴일 근무</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">공휴일 일수</div>
                    <div className="font-semibold">{data.fairnessCutoffs.holiday.total}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최소 근무</div>
                    <div className="font-semibold text-blue-600">{data.fairnessCutoffs.holiday.minRequired}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최대 신청</div>
                    <div className="font-semibold text-green-600">{data.fairnessCutoffs.holiday.maxAllowed}일</div>
                  </div>
                </div>
              </div>
            )}

            {/* 공휴일 전후 형평성 */}
            {data.fairnessSettings?.enableHolidayAdjacent && data.fairnessCutoffs.holidayAdjacent && (
              <div className="p-3 bg-purple-50 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-700">공휴일 전후</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">전체 전후일</div>
                    <div className="font-semibold">{data.fairnessCutoffs.holidayAdjacent.total}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최소 근무</div>
                    <div className="font-semibold text-blue-600">{data.fairnessCutoffs.holidayAdjacent.minRequired}일</div>
                  </div>
                  <div>
                    <div className="text-gray-500">최대 신청</div>
                    <div className="font-semibold text-green-600">{data.fairnessCutoffs.holidayAdjacent.maxAllowed}일</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 안내 메시지 */}
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-sm">
            {canApply ? (
              '형평성 점수가 낮을수록(음수일수록) 더 많은 연차/오프를 신청할 수 있습니다. 많이 일한 만큼 휴식이 보장됩니다.'
            ) : (
              '형평성 기준에 따라 이번 달 신청 가능한 일수를 모두 사용하셨습니다.'
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
