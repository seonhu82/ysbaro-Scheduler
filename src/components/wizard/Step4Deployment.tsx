/**
 * Step 4: 확인 및 배포
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Rocket, ArrowLeft, Calendar, Users, TrendingUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { DayDetailPopup } from '@/components/calendar/DayDetailPopup'

interface Props {
  wizardState: any
  updateWizardState: (updates: any) => void
  onComplete: () => void
  onBack: () => void
}

export default function Step4Deployment({ wizardState, updateWizardState, onComplete, onBack }: Props) {
  const { toast } = useToast()
  const [deploying, setDeploying] = useState(false)
  const [scheduleData, setScheduleData] = useState<any>({})
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(true)
  const [staffStats, setStaffStats] = useState<any[]>([])
  const [isDeployed, setIsDeployed] = useState(false)
  const [scheduleStatus, setScheduleStatus] = useState<'DRAFT' | 'CONFIRMED' | 'DEPLOYED'>('DRAFT')
  const [undeploying, setUndeploying] = useState(false)
  const [enabledDimensions, setEnabledDimensions] = useState({
    night: true,
    weekend: true,
    holiday: false,
    holidayAdjacent: true
  })
  const [totalAssignments, setTotalAssignments] = useState(0)
  const [averageFairness, setAverageFairness] = useState(0)

  // 스케줄 데이터 조회
  useEffect(() => {
    fetchSchedulePreview()
  }, [wizardState.year, wizardState.month])

  const fetchSchedulePreview = async () => {
    try {
      setLoadingSchedule(true)

      // 스케줄 상태 확인
      const statusResponse = await fetch(`/api/schedule/status?year=${wizardState.year}&month=${wizardState.month}`)
      const statusData = await statusResponse.json()

      if (statusData.success && statusData.schedule?.status === 'DEPLOYED') {
        setIsDeployed(true)
        setScheduleStatus('DEPLOYED')
        // DEPLOYED 스케줄 조회
        const response = await fetch(`/api/schedule/monthly-view?year=${wizardState.year}&month=${wizardState.month}&status=DEPLOYED`)
        const data = await response.json()
        if (data.success) {
          setScheduleData(data.scheduleData || {})
        }

        // 직원 통계 조회
        const statsResponse = await fetch(`/api/schedule/staff-stats?year=${wizardState.year}&month=${wizardState.month}&status=DEPLOYED`)
        const statsData = await statsResponse.json()
        if (statsData.success && statsData.data?.stats) {
          setStaffStats(statsData.data.stats)
          if (statsData.data.enabledDimensions) {
            setEnabledDimensions(statsData.data.enabledDimensions)
          }
        }
        setLoadingSchedule(false)
        return
      }

      // 배포 전 스케줄 조회 (CONFIRMED 우선, 없으면 DRAFT)
      let response = await fetch(`/api/schedule/monthly-view?year=${wizardState.year}&month=${wizardState.month}&status=CONFIRMED`)
      let data = await response.json()
      let currentStatus: 'CONFIRMED' | 'DRAFT' = 'CONFIRMED'

      // CONFIRMED가 없으면 DRAFT 조회
      if (!data.success || !data.scheduleData || Object.keys(data.scheduleData).length === 0) {
        response = await fetch(`/api/schedule/monthly-view?year=${wizardState.year}&month=${wizardState.month}&status=DRAFT`)
        data = await response.json()
        currentStatus = 'DRAFT'
      }

      setScheduleStatus(currentStatus)

      if (data.success) {
        setScheduleData(data.scheduleData || {})
      }

      // 직원별 근무일수 통계 조회 (CONFIRMED 우선)
      let statsResponse = await fetch(`/api/schedule/staff-stats?year=${wizardState.year}&month=${wizardState.month}&status=CONFIRMED`)
      let statsData = await statsResponse.json()

      // CONFIRMED가 없으면 DRAFT 조회
      if (!statsData.success || !statsData.data?.stats || statsData.data.stats.length === 0) {
        statsResponse = await fetch(`/api/schedule/staff-stats?year=${wizardState.year}&month=${wizardState.month}&status=DRAFT`)
        statsData = await statsResponse.json()
      }

      console.log('📊 Staff stats response:', statsData)
      console.log('📊 Stats success:', statsData.success)
      console.log('📊 Stats array:', statsData.data?.stats)
      console.log('📊 Stats length:', statsData.data?.stats?.length)

      if (statsData.success && statsData.data?.stats) {
        console.log('📊 Setting staff stats:', statsData.data.stats)
        const stats = statsData.data.stats
        setStaffStats(stats)
        if (statsData.data.enabledDimensions) {
          setEnabledDimensions(statsData.data.enabledDimensions)
        }

        // 총 배정 건수 계산 (totalDays 합계)
        const total = stats.reduce((sum: number, s: any) => sum + s.totalDays, 0)
        setTotalAssignments(total)

        // 평균 형평성 계산 (Step 3과 동일한 방식: overallScore의 평균)
        if (stats.length > 0) {
          // 각 직원의 overallScore 평균 계산
          const overallScores = stats
            .map((s: any) => s.fairness?.overallScore || 0)
            .filter((score: number) => score > 0)

          if (overallScores.length > 0) {
            const avgScore = overallScores.reduce((sum: number, score: number) => sum + score, 0) / overallScores.length
            setAverageFairness(Math.round(avgScore))
          } else {
            setAverageFairness(0)
          }
        } else {
          setAverageFairness(0)
        }

        console.log('📊 Staff stats set complete')
      } else {
        console.error('📊 Failed to load stats:', statsData)
        setStaffStats([])
        setTotalAssignments(0)
        setAverageFairness(0)
      }
    } catch (error) {
      console.error('Failed to fetch schedule preview:', error)
    } finally {
      setLoadingSchedule(false)
    }
  }

  const handleDeploy = async () => {
    setDeploying(true)

    try {
      const response = await fetch('/api/schedule/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: wizardState.year,
          month: wizardState.month,
          scheduleId: wizardState.assignmentResult?.scheduleId
        })
      })

      const data = await response.json()

      if (data.success) {
        // ON_HOLD 자동 승인 프로세스 실행
        await processOnHoldApplications()

        updateWizardState({ schedule: data.schedule })

        toast({
          title: '🎉 배포 완료!',
          description: `${wizardState.year}년 ${wizardState.month}월 스케줄이 배포되었습니다`
        })

        setTimeout(() => {
          onComplete()
        }, 1500)
      } else {
        toast({
          variant: 'destructive',
          title: '배포 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '스케줄 배포 중 오류가 발생했습니다'
      })
    } finally {
      setDeploying(false)
    }
  }

  const processOnHoldApplications = async () => {
    try {
      // ON_HOLD 상태 신청 자동 재검토
      await fetch('/api/leave-management/process-on-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: wizardState.year,
          month: wizardState.month
        })
      })
    } catch (error) {
      console.error('ON_HOLD processing error:', error)
    }
  }

  // 배포 취소
  const handleUndeploy = async () => {
    if (!confirm('배포를 취소하시겠습니까?\n배포 취소 후 스케줄을 수정할 수 있습니다.')) {
      return
    }

    try {
      setUndeploying(true)

      const response = await fetch('/api/schedule/undeploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: wizardState.year,
          month: wizardState.month,
          scheduleId: wizardState.assignmentResult?.scheduleId
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '배포 취소 완료',
          description: '스케줄을 수정할 수 있습니다'
        })
        // 페이지 새로고침하여 DRAFT 상태로 변경
        setIsDeployed(false)
        fetchSchedulePreview()
      } else {
        toast({
          variant: 'destructive',
          title: '배포 취소 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '배포 취소 중 오류가 발생했습니다'
      })
    } finally {
      setUndeploying(false)
    }
  }

  // 이미 배포된 스케줄인 경우
  if (isDeployed) {
    return (
      <div className="space-y-6">
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-6 h-6" />
              이미 배포된 스케줄
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              {wizardState.year}년 {wizardState.month}월 스케줄은 이미 배포되었습니다.
              <br />
              개별 날짜 수정은 캘린더에서 가능하며, 전체 스케줄을 다시 배치하려면 배포를 취소하세요.
            </p>

            {/* 통계 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600">총 근무 배정</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {staffStats.reduce((sum: number, s: any) => sum + s.totalDays, 0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white">
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600">배치된 직원</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {staffStats.length}명
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-blue-800">
                <strong>💡 스케줄 수정 방법</strong>
              </p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1 ml-4 list-disc">
                <li><strong>개별 날짜 수정:</strong> 캘린더에서 날짜를 클릭하여 해당 날짜의 직원 배치를 수정할 수 있습니다.</li>
                <li><strong>전체 재배치:</strong> 배포를 취소한 후 1단계부터 다시 시작하여 전체 스케줄을 재배치할 수 있습니다.</li>
              </ul>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="destructive"
                onClick={handleUndeploy}
                disabled={undeploying}
              >
                {undeploying ? '취소 중...' : '배포 취소'}
              </Button>
              <Button onClick={() => window.location.href = '/calendar'}>
                <Calendar className="w-4 h-4 mr-2" />
                캘린더로 이동
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/schedule'}>
                스케줄 관리로 돌아가기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            4단계: 최종 확인 및 배포
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 요약 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="text-2xl font-bold text-blue-900">
                  {wizardState.year}년 {wizardState.month}월
                </div>
                <div className="text-sm text-blue-700 mt-1">배포 대상 월</div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-900">
                  {totalAssignments}
                </div>
                <div className="text-sm text-green-700 mt-1">총 근무 배정</div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="text-2xl font-bold text-purple-900">
                  {averageFairness}점
                </div>
                <div className="text-sm text-purple-700 mt-1">형평성 점수</div>
              </CardContent>
            </Card>
          </div>

          {/* 배포 안내 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <div className="flex gap-4">
              <Rocket className="w-8 h-8 text-blue-500 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  스케줄 배포 준비 완료
                </h3>
                <p className="text-sm text-gray-700 mb-4">
                  아래 캘린더에서 스케줄을 최종 확인한 후 배포해주세요. 배포 후에는 다음 작업이 자동으로 수행됩니다:
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    스케줄 상태가 "DEPLOYED"로 변경됩니다
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    ON_HOLD 상태의 연차/오프가 자동으로 재검토됩니다
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    승인 가능한 항목은 자동으로 승인됩니다
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    직원들에게 배포 알림이 전송됩니다
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 캘린더 미리보기 */}
          {loadingSchedule ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">스케줄 불러오는 중...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-5 h-5" />
                <h3 className="font-semibold">배포 예정 스케줄 최종 확인</h3>
              </div>
              <CalendarGrid
                year={wizardState.year}
                month={wizardState.month}
                scheduleData={scheduleData}
                onDateClick={(date) => setSelectedDate(date)}
              />
              <p className="text-xs text-gray-500 text-center">
                💡 날짜를 클릭하면 해당 일자의 원장 및 직원 배치를 상세히 확인할 수 있습니다
              </p>

              {/* 직원별 근무일수 통계 */}
              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  직원별 근무일수 통계 (총 {staffStats.length}명)
                </h3>
                {staffStats.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {staffStats.map((stat: any) => (
                      <div key={stat.staffId} className="bg-white rounded border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{stat.staffName}</span>
                            <Badge variant="outline" className="text-xs">
                              {stat.categoryName}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2 text-xs">
                          {/* 총 근무일 (실제 근무) */}
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">총 근무:</span>
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-blue-600">{stat.totalDays}일</span>
                              {stat.fairness?.total && (
                                <span className={`text-xs ${
                                  stat.fairness.total.deviation > 0 ? 'text-green-600' :
                                  stat.fairness.total.deviation < 0 ? 'text-red-600' : 'text-gray-400'
                                }`}>
                                  ({stat.fairness.total.deviation > 0 ? '+' : ''}{stat.fairness.total.deviation.toFixed(1)})
                                </span>
                              )}
                            </div>
                          </div>
                          {/* 연차 */}
                          {(stat.annualDays || 0) > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">연차:</span>
                              <span className="font-semibold text-green-600">{stat.annualDays}일</span>
                            </div>
                          )}
                          {/* 오프 */}
                          {(stat.offDays || 0) > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">오프:</span>
                              <span className="font-semibold text-gray-600">{stat.offDays}일</span>
                            </div>
                          )}
                          <div className="border-t pt-2 mt-2"></div>
                          {/* 야간 */}
                          {enabledDimensions.night && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">야간:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-purple-600">{stat.nightShiftDays}일</span>
                                {stat.fairness?.night && (
                                  <span className={`text-xs ${
                                    stat.fairness.night.deviation > 0 ? 'text-green-600' :
                                    stat.fairness.night.deviation < 0 ? 'text-red-600' : 'text-gray-400'
                                  }`}>
                                    ({stat.fairness.night.deviation > 0 ? '+' : ''}{stat.fairness.night.deviation.toFixed(1)})
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {/* 주말 */}
                          {enabledDimensions.weekend && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">주말:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-pink-600">{stat.weekendDays || 0}일</span>
                                {stat.fairness?.weekend && (
                                  <span className={`text-xs ${
                                    stat.fairness.weekend.deviation > 0 ? 'text-green-600' :
                                    stat.fairness.weekend.deviation < 0 ? 'text-red-600' : 'text-gray-400'
                                  }`}>
                                    ({stat.fairness.weekend.deviation > 0 ? '+' : ''}{stat.fairness.weekend.deviation.toFixed(1)})
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {/* 공휴일 */}
                          {enabledDimensions.holiday && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">공휴일:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-red-600">{stat.holidayDays || 0}일</span>
                                {stat.fairness?.holiday && (
                                  <span className={`text-xs ${
                                    stat.fairness.holiday.deviation > 0 ? 'text-green-600' :
                                    stat.fairness.holiday.deviation < 0 ? 'text-red-600' : 'text-gray-400'
                                  }`}>
                                    ({stat.fairness.holiday.deviation > 0 ? '+' : ''}{stat.fairness.holiday.deviation.toFixed(1)})
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {/* 휴일연장 */}
                          {enabledDimensions.holidayAdjacent && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">휴일연장:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-amber-600">{stat.holidayAdjacentDays || 0}일</span>
                                {stat.fairness?.holidayAdjacent && (
                                  <span className={`text-xs ${
                                    stat.fairness.holidayAdjacent.deviation > 0 ? 'text-green-600' :
                                    stat.fairness.holidayAdjacent.deviation < 0 ? 'text-red-600' : 'text-gray-400'
                                  }`}>
                                    ({stat.fairness.holidayAdjacent.deviation > 0 ? '+' : ''}{stat.fairness.holidayAdjacent.deviation.toFixed(1)})
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">통계 데이터를 불러오는 중...</p>
                )}
              </div>
            </div>
          )}

          {/* 배포 버튼 */}
          <div className="text-center py-8 border-t-2 border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              ✓ 위의 캘린더에서 스케줄을 최종 확인하셨나요?
            </p>
            <Button
              onClick={handleDeploy}
              disabled={deploying || loadingSchedule}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-12 py-6 text-lg"
            >
              {deploying ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  배포 중...
                </>
              ) : (
                <>
                  <Rocket className="w-6 h-6 mr-3" />
                  스케줄 배포하기
                </>
              )}
            </Button>
            <p className="text-sm text-red-600 mt-4 font-medium">
              ⚠️ 배포 후에는 수정이 어려우니 신중하게 확인해주세요
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 하단 버튼 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} size="lg" disabled={deploying}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          재배정하기
        </Button>
        <p className="text-sm text-gray-500 self-center">
          💡 직원 배치를 다시 하려면 "재배정하기"를 클릭하세요
        </p>
      </div>

      {/* 날짜 상세 팝업 */}
      <DayDetailPopup
        date={selectedDate}
        isOpen={!!selectedDate}
        onClose={() => {
          setSelectedDate(null)
          // 팝업 닫을 때 스케줄 데이터 새로고침
          fetchSchedulePreview()
        }}
        year={wizardState.year}
        month={wizardState.month}
        status={scheduleStatus}
      />
    </div>
  )
}
