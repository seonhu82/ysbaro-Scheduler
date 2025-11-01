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
      // DRAFT 스케줄만 조회 (배포 전 예정 스케줄)
      const response = await fetch(`/api/schedule/monthly-view?year=${wizardState.year}&month=${wizardState.month}&status=DRAFT`)
      const data = await response.json()

      if (data.success) {
        setScheduleData(data.scheduleData || {})
      }

      // 직원별 근무일수 통계 조회
      const statsResponse = await fetch(`/api/schedule/staff-stats?year=${wizardState.year}&month=${wizardState.month}&status=DRAFT`)
      const statsData = await statsResponse.json()

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

        // 평균 형평성 계산 (모든 활성화된 차원의 표준편차 합산)
        if (stats.length > 0) {
          const enabled = statsData.data.enabledDimensions || {}

          // 설정에 따라 동적으로 차원 구성
          const dimensions = [
            { key: 'totalDays', enabled: true, weight: 1.0, label: '총 근무' }
          ]

          if (enabled.night) {
            dimensions.push({ key: 'nightShiftDays', enabled: true, weight: 1.2, label: '야간' })
          }
          if (enabled.weekend) {
            dimensions.push({ key: 'weekendDays', enabled: true, weight: 1.1, label: '주말' })
          }
          if (enabled.holiday) {
            dimensions.push({ key: 'holidayDays', enabled: true, weight: 1.15, label: '공휴일' })
          }
          if (enabled.holidayAdjacent) {
            dimensions.push({ key: 'holidayAdjacentDays', enabled: true, weight: 1.15, label: '공휴일전후' })
          }

          let totalWeightedStdDev = 0

          for (const dim of dimensions) {
            const values = stats.map((s: any) => s[dim.key] || 0)
            const avg = values.reduce((sum: number, v: number) => sum + v, 0) / values.length
            const variance = values.reduce((sum: number, v: number) =>
              sum + Math.pow(v - avg, 2), 0
            ) / values.length
            const stdDev = Math.sqrt(variance)

            // 가중치 적용한 표준편차를 합산
            totalWeightedStdDev += stdDev * dim.weight
          }

          // 형평성 점수: 표준편차 합이 낮을수록 높은 점수
          // 총합 0 = 100점, 총합 5 = 50점, 총합 10 = 0점
          const fairnessScore = Math.max(0, Math.min(100, 100 - totalWeightedStdDev * 10))
          setAverageFairness(Math.round(fairnessScore * 10) / 10)
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
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">총 근무:</span>
                            <span className="font-semibold text-blue-600">{stat.totalDays}일</span>
                          </div>
                          {enabledDimensions.night && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">야간:</span>
                              <span className="font-semibold text-purple-600">{stat.nightShiftDays}일</span>
                            </div>
                          )}
                          {enabledDimensions.weekend && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">주말:</span>
                              <span className="font-semibold text-pink-600">{stat.weekendDays || 0}일</span>
                            </div>
                          )}
                          {enabledDimensions.holiday && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">공휴일:</span>
                              <span className="font-semibold text-red-600">{stat.holidayDays || 0}일</span>
                            </div>
                          )}
                          {enabledDimensions.holidayAdjacent && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">공연장:</span>
                              <span className="font-semibold text-amber-600">{stat.holidayAdjacentDays || 0}일</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600">연차:</span>
                            <span className="font-semibold text-green-600">{stat.annualDays || 0}일</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">오프:</span>
                            <span className="font-semibold text-orange-600">{stat.offDays || 0}일</span>
                          </div>
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
        status="DRAFT"
      />
    </div>
  )
}
