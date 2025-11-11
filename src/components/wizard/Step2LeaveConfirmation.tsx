/**
 * Step 2: 연차/오프 확인 및 ON_HOLD 처리
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { isInPreviousMonth, isInNextMonth } from '@/lib/date-utils'

interface Props {
  wizardState: any
  updateWizardState: (updates: any) => void
  onNext: () => void
  onBack: () => void
}

interface LeaveApplication {
  id: string
  staffName: string
  date: string
  leaveType: 'ANNUAL' | 'OFF'
  status: string
  fairnessScore?: number
}

export default function Step2LeaveConfirmation({ wizardState, updateWizardState, onNext, onBack }: Props) {
  const { toast } = useToast()
  const [applications, setApplications] = useState<LeaveApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchLeaveApplications()
  }, [wizardState.year, wizardState.month])

  const fetchLeaveApplications = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/leave-management/list?year=${wizardState.year}&month=${wizardState.month}&status=PENDING`
      )
      const data = await response.json()

      if (data.success) {
        setApplications(data.applications || [])
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error)
      toast({
        variant: 'destructive',
        title: '연차 신청 로드 실패'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async () => {
    setProcessing(true)

    try {
      // 각 신청에 대해 형평성 검증 및 상태 업데이트
      const response = await fetch('/api/leave-management/bulk-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: wizardState.year,
          month: wizardState.month
        })
      })

      const data = await response.json()

      if (data.success) {
        updateWizardState({ leaveApplications: data.results })
        toast({
          title: '검토 완료',
          description: `${data.results.confirmed}건 승인, ${data.results.onHold}건 보류`
        })
        onNext()
      } else {
        toast({
          variant: 'destructive',
          title: '검토 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '신청 검토 중 오류가 발생했습니다'
      })
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge className="bg-green-500">승인</Badge>
      case 'ON_HOLD':
        return <Badge className="bg-orange-500">보류</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-500">대기</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">신청 내역 로딩 중...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            2단계: 연차/오프 확인 및 승인/보류
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">자동 검토 프로세스</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>1단계: 동적 제한 시뮬레이션 (주4일제, 구분별 인원, 편차 등) - 실패 시 즉시 거절</li>
                  <li>2단계: 형평성 편차 검증 (월별 최소 요구 + 연간 누적) - 미달 시 ON_HOLD</li>
                  <li>3단계: 구분별 슬롯 가용성 확인 - 부족 시 ON_HOLD</li>
                  <li>✅ 모두 통과 시 자동 승인 (PENDING), ON_HOLD는 Step 3 스케줄 확정 후 재검토</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 신청 목록 */}
          {applications.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">대기 중인 연차/오프 신청이 없습니다</p>
              <p className="text-sm text-gray-400 mt-2">다음 단계로 진행하세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  총 {applications.length}건의 신청이 검토 대기 중입니다
                </p>
              </div>

              {applications.map((app) => {
                const appDate = new Date(app.date)
                const isPrevMonth = isInPreviousMonth(appDate, wizardState.year, wizardState.month)
                const isNextMonth = isInNextMonth(appDate, wizardState.year, wizardState.month)
                const isOtherMonth = isPrevMonth || isNextMonth

                return (
                  <div
                    key={app.id}
                    className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 ${
                      isOtherMonth ? 'bg-blue-50 border-blue-300' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{app.staffName}</span>
                        <Badge variant={app.leaveType === 'ANNUAL' ? 'default' : 'secondary'}>
                          {app.leaveType === 'ANNUAL' ? '연차' : '오프'}
                        </Badge>
                        {getStatusBadge(app.status)}
                        {isOtherMonth && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                            {isPrevMonth ? '이전달' : '다음달'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {format(new Date(app.date), 'yyyy년 M월 d일 (E)', { locale: ko })}
                      </div>
                    </div>
                    {app.fairnessScore !== undefined && (
                      <div className="text-right">
                        <div className="text-sm text-gray-500">형평성 점수</div>
                        <div className={`text-lg font-bold ${
                          app.fairnessScore >= 75 ? 'text-green-600' :
                          app.fairnessScore >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {app.fairnessScore}점
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 하단 버튼 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} size="lg">
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전 단계
        </Button>
        <Button onClick={handleReview} size="lg" disabled={processing}>
          {processing ? '검토 중...' : applications.length > 0 ? '자동 검토 시작' : '다음 단계'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
