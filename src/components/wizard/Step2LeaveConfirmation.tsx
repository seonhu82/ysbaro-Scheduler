/**
 * Step 2: 연차/오프 확인 및 ON_HOLD 처리
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Calendar, Check, X } from 'lucide-react'
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
  const [pendingApps, setPendingApps] = useState<LeaveApplication[]>([])
  const [onHoldApps, setOnHoldApps] = useState<LeaveApplication[]>([])
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [cancelledCount, setCancelledCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchLeaveApplications()
  }, [wizardState.year, wizardState.month])

  const fetchLeaveApplications = async () => {
    try {
      setLoading(true)

      console.log('Fetching applications for:', wizardState.year, wizardState.month)

      // 모든 상태의 신청을 가져옴
      const response = await fetch(
        `/api/leave-management/list?year=${wizardState.year}&month=${wizardState.month}`
      )
      const data = await response.json()

      console.log('API Response:', data)

      if (data.success) {
        const allApps = data.applications || []
        console.log('All applications:', allApps)

        setApplications(allApps)

        // 상태별로 분류
        const pending = allApps.filter((app: LeaveApplication) => app.status === 'PENDING')
        const onHold = allApps.filter((app: LeaveApplication) => app.status === 'ON_HOLD')
        const confirmed = allApps.filter((app: LeaveApplication) => app.status === 'CONFIRMED')
        const cancelled = allApps.filter((app: LeaveApplication) => app.status === 'CANCELLED')

        console.log('Pending:', pending.length, 'OnHold:', onHold.length, 'Confirmed:', confirmed.length, 'Cancelled:', cancelled.length)

        setPendingApps(pending)
        setOnHoldApps(onHold)
        setConfirmedCount(confirmed.length)
        setCancelledCount(cancelled.length)
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

  const handleStatusChange = async (applicationId: string, newStatus: 'CONFIRMED' | 'CANCELLED') => {
    try {
      const response = await fetch(`/api/leave-management/${applicationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const result = await response.json()

      if (result.success) {
        const statusLabel = newStatus === 'CONFIRMED' ? '승인' : '반려'
        toast({
          title: `${statusLabel} 완료`,
          description: `연차 신청이 ${statusLabel}되었습니다.`,
        })
        fetchLeaveApplications()
      } else {
        toast({
          variant: 'destructive',
          title: '처리 실패',
          description: result.error || '상태 변경에 실패했습니다.',
        })
      }
    } catch (error) {
      console.error('Failed to change status:', error)
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다.',
      })
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
                  <li>신청 시 이미 편차 검증이 완료되었습니다</li>
                  <li>대기중(PENDING) 신청은 모두 자동 승인됩니다</li>
                  <li>보류(ON_HOLD) 항목은 수동으로 검토하여 승인/반려할 수 있습니다</li>
                  <li>개별 신청은 승인/반려 버튼으로 직접 처리 가능합니다</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 승인/반려 통계 - 해당 월 기준 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">{confirmedCount}</div>
              <div className="text-sm text-green-600">승인 완료 ({wizardState.year}년 {wizardState.month}월)</div>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-700">{cancelledCount}</div>
              <div className="text-sm text-red-600">반려 완료 ({wizardState.year}년 {wizardState.month}월)</div>
            </div>
          </div>

          {/* 대기 중인 신청 목록 */}
          {pendingApps.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Badge className="bg-yellow-500">대기중</Badge>
                <span>{pendingApps.length}건</span>
              </h3>
              {pendingApps.map((app) => {
                const appDate = new Date(app.date)
                const isPrevMonth = isInPreviousMonth(appDate, wizardState.year, wizardState.month)
                const isNextMonth = isInNextMonth(appDate, wizardState.year, wizardState.month)
                const isOtherMonth = isPrevMonth || isNextMonth

                return (
                  <div
                    key={app.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      isOtherMonth ? 'bg-blue-50 border-blue-300' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{app.staffName}</span>
                        <Badge variant={app.leaveType === 'ANNUAL' ? 'default' : 'secondary'}>
                          {app.leaveType === 'ANNUAL' ? '연차' : '오프'}
                        </Badge>
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
                    <div className="flex items-center gap-4">
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusChange(app.id, 'CONFIRMED')
                          }}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusChange(app.id, 'CANCELLED')
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          반려
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 보류 중인 신청 목록 */}
          {onHoldApps.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Badge className="bg-orange-500">보류</Badge>
                <span>{onHoldApps.length}건</span>
              </h3>
              {onHoldApps.map((app) => {
                const appDate = new Date(app.date)
                const isPrevMonth = isInPreviousMonth(appDate, wizardState.year, wizardState.month)
                const isNextMonth = isInNextMonth(appDate, wizardState.year, wizardState.month)
                const isOtherMonth = isPrevMonth || isNextMonth

                return (
                  <div
                    key={app.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      isOtherMonth ? 'bg-blue-50 border-blue-300' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{app.staffName}</span>
                        <Badge variant={app.leaveType === 'ANNUAL' ? 'default' : 'secondary'}>
                          {app.leaveType === 'ANNUAL' ? '연차' : '오프'}
                        </Badge>
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
                    <div className="flex items-center gap-4">
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusChange(app.id, 'CONFIRMED')
                          }}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStatusChange(app.id, 'CANCELLED')
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4 mr-1" />
                          반려
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 신청이 하나도 없을 때 */}
          {applications.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">연차/오프 신청이 없습니다</p>
              <p className="text-sm text-gray-400 mt-2">다음 단계로 진행하세요</p>
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
          {processing ? '검토 중...' : pendingApps.length > 0 ? '자동 검토 시작' : '다음 단계'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
