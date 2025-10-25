/**
 * 형평성 체크 컴포넌트
 * 공개 연차/오프 신청 페이지에서 사용
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react'

interface FairnessCheckProps {
  staffId: string
  startDate: Date
  endDate: Date
}

interface CheckResult {
  canApply: boolean
  currentOffDays: number
  minRequired?: number
  maxAllowed?: number
  remaining: number
  message: string
}

interface FairnessData {
  canApply: boolean
  monthlyCheck: CheckResult
  yearlyCheck: CheckResult
  overallMessage: string
}

export default function FairnessCheck({ staffId, startDate, endDate }: FairnessCheckProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<FairnessData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkEligibility = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          staffId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })

        const response = await fetch(`/api/fairness/check-eligibility?${params}`)
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

    if (staffId && startDate && endDate) {
      checkEligibility()
    }
  }, [staffId, startDate, endDate])

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
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) {
    return null
  }

  return (
    <Card className={data.canApply ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">형평성 확인</CardTitle>
          <Badge variant={data.canApply ? 'default' : 'destructive'} className="gap-1">
            {data.canApply ? (
              <>
                <CheckCircle className="w-3 h-3" />
                신청 가능
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3" />
                신청 제한
              </>
            )}
          </Badge>
        </div>
        <CardDescription className={data.canApply ? 'text-green-700' : 'text-red-700'}>
          {data.overallMessage}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 월별 형평성 */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm">이번 달 오프 현황</span>
            </div>
            {data.monthlyCheck.canApply ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                기준 충족
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600">
                기준 미달
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-2">{data.monthlyCheck.message}</p>
          <div className="flex gap-4 text-xs text-gray-600">
            <div>
              <span className="font-medium">현재:</span> {data.monthlyCheck.currentOffDays}일
            </div>
            {data.monthlyCheck.minRequired !== undefined && (
              <div>
                <span className="font-medium">최소:</span> {data.monthlyCheck.minRequired}일
              </div>
            )}
            <div>
              <span className="font-medium">여유:</span> {data.monthlyCheck.remaining}일
            </div>
          </div>
        </div>

        {/* 연간 형평성 */}
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-sm">올해 누적 오프 현황</span>
            </div>
            {data.yearlyCheck.canApply ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                기준 충족
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600">
                기준 초과
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-2">{data.yearlyCheck.message}</p>
          <div className="flex gap-4 text-xs text-gray-600">
            <div>
              <span className="font-medium">현재:</span> {data.yearlyCheck.currentOffDays}일
            </div>
            {data.yearlyCheck.maxAllowed !== undefined && (
              <div>
                <span className="font-medium">최대:</span> {data.yearlyCheck.maxAllowed}일
              </div>
            )}
            <div>
              <span className="font-medium">남은 일수:</span> {data.yearlyCheck.remaining}일
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        {!data.canApply && (
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription className="text-sm">
              형평성 기준에 따라 현재 연차/오프 신청이 제한됩니다.
              {!data.monthlyCheck.canApply && ' 이번 달 최소 오프 일수를 충족해야 합니다.'}
              {!data.yearlyCheck.canApply && ' 올해 최대 오프 일수를 초과할 수 없습니다.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
