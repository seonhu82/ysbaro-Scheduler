/**
 * Step 3: 자동 배정 및 미리보기
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Zap, AlertTriangle, ArrowRight, ArrowLeft, Users, TrendingUp, BarChart3, Calendar, UserCheck, CheckCircle2, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  wizardState: any
  updateWizardState: (updates: any) => void
  onNext: () => void
  onBack: () => void
}

export default function Step3AutoAssignment({ wizardState, updateWizardState, onNext, onBack }: Props) {
  const { toast } = useToast()
  const [assigning, setAssigning] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [report, setReport] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [hasExistingAssignments, setHasExistingAssignments] = useState(false)

  // 컴포넌트 마운트 시 기존 배치 데이터 확인 및 로드
  useEffect(() => {
    const checkExistingAssignments = async () => {
      try {
        const response = await fetch(`/api/schedule/assignment-report?year=${wizardState.year}&month=${wizardState.month}`)
        const data = await response.json()

        if (data.success && data.report?.summary?.totalAssignments > 0) {
          setHasExistingAssignments(true)
          setReport(data.report)
        }
      } catch (error) {
        console.error('기존 배치 확인 실패:', error)
      }
    }

    checkExistingAssignments()
  }, [wizardState.year, wizardState.month])

  const loadReport = async () => {
    console.log('📊 리포트 로드 시작:', wizardState.year, wizardState.month)
    setLoadingReport(true)
    try {
      const response = await fetch(`/api/schedule/assignment-report?year=${wizardState.year}&month=${wizardState.month}`)
      const data = await response.json()

      console.log('📊 리포트 API 응답:', data)

      if (data.success) {
        console.log('✅ 리포트 데이터 설정:', data.report)
        setReport(data.report)
      } else {
        console.error('❌ 리포트 로드 실패:', data.error)
      }
    } catch (error) {
      console.error('❌ 리포트 로드 에러:', error)
    } finally {
      setLoadingReport(false)
    }
  }

  const handleAutoAssign = async (forceRedeploy = false) => {
    console.log('자동배정 시작:', { year: wizardState.year, month: wizardState.month, forceRedeploy })
    setAssigning(true)

    try {
      console.log('API 호출 중...')
      const response = await fetch('/api/schedule/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: wizardState.year,
          month: wizardState.month,
          forceRedeploy
        })
      })
      console.log('API 응답 받음:', response.status)

      const data = await response.json()

      // Handle deployed schedule warning (status 409)
      if (response.status === 409 && data.error === 'DEPLOYED_SCHEDULE_WARNING') {
        const confirmed = window.confirm(data.message)

        if (confirmed) {
          // User confirmed, retry with forceRedeploy flag
          setAssigning(false)
          return handleAutoAssign(true)
        } else {
          // User cancelled
          toast({
            title: '재배치 취소',
            description: '스케줄 재배치가 취소되었습니다'
          })
          setAssigning(false)
          return
        }
      }

      if (data.success) {
        console.log('자동 배정 성공. Warnings:', data.warnings)
        setPreview(data.preview)
        updateWizardState({ assignmentResult: data.result })

        if (data.warnings && data.warnings.length > 0) {
          console.log('Warnings 설정:', data.warnings)
          setWarnings(data.warnings)
        } else {
          setWarnings([])
        }

        // 리포트 로드
        await loadReport()

        toast({
          title: '자동 배정 완료',
          description: '스케줄이 성공적으로 생성되었습니다'
        })
      } else {
        toast({
          variant: 'destructive',
          title: '자동 배정 실패',
          description: data.error
        })
      }
    } catch (error) {
      console.error('자동배정 에러:', error)
      toast({
        variant: 'destructive',
        title: '오류',
        description: '자동 배정 중 오류가 발생했습니다'
      })
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            3단계: 자동 배정 및 미리보기
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!preview && !hasExistingAssignments ? (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <Zap className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-purple-700">
                    <p className="font-semibold mb-2">자동 배정 알고리즘</p>
                    <ul className="space-y-1.5 ml-1">
                      <li className="flex gap-2">
                        <span className="text-purple-600">•</span>
                        <div>
                          <span className="font-medium">5가지 형평성 점수 기반 배정</span>
                          <div className="text-xs text-purple-600 ml-0.5">총근무일, 야간, 주말, 공휴일, 공휴일인접 균등 분배</div>
                        </div>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-purple-600">•</span>
                        <div>
                          <span className="font-medium">카테고리별 필수 인원 충족</span>
                          <div className="text-xs text-purple-600 ml-0.5">카테고리 직원 우선 배정 + 유연 직원 자동 보충</div>
                        </div>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-purple-600">•</span>
                        <div>
                          <span className="font-medium">주 4일 근무 자동 계산</span>
                          <div className="text-xs text-purple-600 ml-0.5">최대 4일 제한 + 부족분 자동 조정</div>
                        </div>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-purple-600">•</span>
                        <div>
                          <span className="font-medium">연차/오프 자동 반영</span>
                          <div className="text-xs text-purple-600 ml-0.5">연차는 근무로 카운트, OFF는 2차 조정</div>
                        </div>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-purple-600">•</span>
                        <div>
                          <span className="font-medium">실시간 형평성 업데이트</span>
                          <div className="text-xs text-purple-600 ml-0.5">각 배정마다 즉시 DB 반영하여 공정성 유지</div>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="text-center py-12">
                <Users className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600 mb-6">
                  {wizardState.year}년 {wizardState.month}월 스케줄을 자동으로 배정합니다
                </p>
                <Button
                  onClick={() => handleAutoAssign()}
                  disabled={assigning}
                  size="lg"
                  className="bg-purple-500 hover:bg-purple-600"
                >
                  {assigning ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      자동 배정 중...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      자동 배정 시작
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : hasExistingAssignments && !preview ? (
            <>
              {/* 기존 배치가 있을 때 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">이미 배치된 스케줄이 있습니다</span>
                </div>
                <p className="text-sm text-blue-600 ml-7">
                  아래에서 현재 배치 상태를 확인하거나, 재배정 버튼을 눌러 새로 배치할 수 있습니다.
                </p>
              </div>

              <div className="flex justify-center gap-3 mb-6">
                <Button
                  onClick={() => handleAutoAssign()}
                  disabled={assigning}
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  {assigning ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-700 mr-2"></div>
                      재배정 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      재배정
                    </>
                  )}
                </Button>
              </div>

              {/* 보고서 표시 */}
              {report && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-6 text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                        <div className="text-2xl font-bold">{report.summary?.totalAssignments || 0}</div>
                        <div className="text-sm text-gray-500">총 배정 건수</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6 text-center">
                        <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <div className="text-2xl font-bold">{report.summary?.averageFairness || 0}점</div>
                        <div className="text-sm text-gray-500">평균 형평성 편차</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-6 text-center">
                        <UserCheck className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                        <div className="text-2xl font-bold">{report.summary?.totalStaff || 0}</div>
                        <div className="text-sm text-gray-500">배치 대상 직원</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* 배정 결과 미리보기 */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                      <div className="text-2xl font-bold">{preview.totalAssignments || 0}</div>
                      <div className="text-sm text-gray-500">총 배정 건수</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6 text-center">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <div className="text-2xl font-bold">{preview.averageFairness || 0}점</div>
                      <div className="text-sm text-gray-500">평균 형평성 점수</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6 text-center">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                      <div className="text-2xl font-bold">{warnings.length}</div>
                      <div className="text-sm text-gray-500">경고 사항</div>
                    </CardContent>
                  </Card>
                </div>

                {warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-800 mb-2">경고 사항</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                          {warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-green-700">
                        <TrendingUp className="w-5 h-5" />
                        <p className="font-medium">자동 배정이 완료되었습니다</p>
                      </div>
                      <p className="text-sm text-green-600 mt-2">
                        다음 단계에서 최종 확인 후 배포할 수 있습니다
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setPreview(null)
                        setWarnings([])
                        setReport(null)
                        handleAutoAssign(true)
                      }}
                      disabled={assigning}
                      variant="outline"
                      className="border-green-300 hover:bg-green-100"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      재배치
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 상세 배치 리포트 */}
      {console.log('🎨 렌더링 상태 - preview:', !!preview, 'report:', !!report, 'reportData:', report ? Object.keys(report) : 'null')}
      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              배치 결과 리포트
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 주차별 분석 */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                주차별 분석
              </h3>
              <div className="space-y-3">
                {report.weeklyStats.map((week: any) => (
                  <div key={week.weekKey} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-medium text-sm">{week.weekKey}</div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={week.offComplianceRate >= 90 ? 'default' : week.offComplianceRate >= 70 ? 'secondary' : 'destructive'}>
                          오프 {week.offComplianceRate}%
                        </Badge>
                        <Badge variant={week.week4ComplianceRate >= 90 ? 'default' : week.week4ComplianceRate >= 70 ? 'secondary' : 'destructive'}>
                          주4일 {week.week4ComplianceRate}%
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">오프 배치:</span>
                        <span className="font-medium">{week.offCount}건 / {week.offTarget}건</span>
                      </div>
                    </div>

                    {week.holidays && week.holidays.length > 0 && (
                      <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                        <div className="text-xs font-medium text-red-700 mb-1">
                          🎌 공휴일
                        </div>
                        <div className="space-y-1">
                          {week.holidays.map((holiday: any) => (
                            <div key={holiday.date} className="text-xs text-red-600">
                              {holiday.name} ({new Date(holiday.date).getMonth() + 1}/{new Date(holiday.date).getDate()}) - 추가 {week.holidayOffCount}명 OFF 처리
                            </div>
                          ))}
                        </div>
                        {week.week4ComplianceRate < 100 && (
                          <div className="text-xs text-red-600 mt-2">
                            ℹ️ 공휴일로 인해 일부 직원이 주4일 미만 근무했습니다.
                          </div>
                        )}
                      </div>
                    )}

                    {week.staffBelowMinimum && week.staffBelowMinimum.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs font-medium text-amber-600 mb-2">
                          ⚠️ 주4일 미달 직원 ({week.staffBelowMinimum.length}명)
                        </div>
                        <div className="space-y-1">
                          {week.staffBelowMinimum.slice(0, 3).map((staff: any) => (
                            <div key={staff.staffId} className="text-xs text-gray-600 flex justify-between">
                              <span>{staff.staffName}</span>
                              <span>{staff.workDays}일 - {staff.reason}</span>
                            </div>
                          ))}
                          {week.staffBelowMinimum.length > 3 && (
                            <div className="text-xs text-gray-500">
                              외 {week.staffBelowMinimum.length - 3}명
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 누적 편차 분석 */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                누적 편차 분석
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 많이 근무한 직원 (음수 편차) */}
                <div className="border rounded-lg p-4">
                  <div className="text-sm font-medium text-red-600 mb-3">
                    ⬇️ 평균보다 많이 근무 (TOP 5)
                  </div>
                  <div className="space-y-2">
                    {report.staffDeviations.topNegative.length > 0 ? (
                      report.staffDeviations.topNegative.map((staff: any) => (
                        <div key={staff.staffId} className="text-xs border-b pb-2 last:border-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{staff.staffName}</span>
                            <span className="text-red-600 font-bold">
                              {staff.totalDeviation > 0 ? '+' : ''}{staff.totalDeviation}일
                            </span>
                          </div>
                          <div className="text-gray-600 flex justify-between">
                            <span>{staff.categoryName || '미지정'}</span>
                            <span>실제 {staff.actualWorkDays}일 (평균 {staff.averageWorkDays}일)</span>
                          </div>
                          {staff.deviationDetails && report.fairnessWeights && (
                            <div className="mt-1 text-gray-500">
                              {Object.entries(report.fairnessWeights).map(([key, weight]: [string, any]) => {
                                if (weight > 0 && staff.deviationDetails[key] !== undefined) {
                                  const labels: Record<string, string> = {
                                    night: '야간',
                                    weekend: '주말',
                                    holiday: '공휴일',
                                    holidayAdjacent: '휴일연장'
                                  }
                                  const label = labels[key] || key
                                  const value = staff.deviationDetails[key]
                                  return `${label} ${value > 0 ? '+' : ''}${value}`
                                }
                                return null
                              }).filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">해당 직원 없음</div>
                    )}
                  </div>
                </div>

                {/* 적게 근무한 직원 (양수 편차) */}
                <div className="border rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-600 mb-3">
                    ⬆️ 평균보다 적게 근무 (TOP 5)
                  </div>
                  <div className="space-y-2">
                    {report.staffDeviations.topPositive.length > 0 ? (
                      report.staffDeviations.topPositive.map((staff: any) => (
                        <div key={staff.staffId} className="text-xs border-b pb-2 last:border-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{staff.staffName}</span>
                            <span className="text-blue-600 font-bold">
                              {staff.totalDeviation > 0 ? '+' : ''}{staff.totalDeviation}일
                            </span>
                          </div>
                          <div className="text-gray-600 flex justify-between">
                            <span>{staff.categoryName || '미지정'}</span>
                            <span>실제 {staff.actualWorkDays}일 (평균 {staff.averageWorkDays}일)</span>
                          </div>
                          {staff.deviationDetails && report.fairnessWeights && (
                            <div className="mt-1 text-gray-500">
                              {Object.entries(report.fairnessWeights).map(([key, weight]: [string, any]) => {
                                if (weight > 0 && staff.deviationDetails[key] !== undefined) {
                                  const labels: Record<string, string> = {
                                    night: '야간',
                                    weekend: '주말',
                                    holiday: '공휴일',
                                    holidayAdjacent: '휴일연장'
                                  }
                                  const label = labels[key] || key
                                  const value = staff.deviationDetails[key]
                                  return `${label} ${value > 0 ? '+' : ''}${value}`
                                }
                                return null
                              }).filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">해당 직원 없음</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 카테고리별 통계 */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                카테고리별 통계
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(report.categoryStats).map(([category, stats]: [string, any]) => (
                  <div key={category} className="border rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-700 mb-2">{category}</div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>평균 근무:</span>
                        <span className="font-medium">{stats.averageWorkDays}일</span>
                      </div>
                      <div className="flex justify-between">
                        <span>유연 배치:</span>
                        <span className="font-medium">{stats.flexibleAssignments}건</span>
                      </div>
                      <div className="flex justify-between">
                        <span>인원:</span>
                        <span className="font-medium">{stats.totalStaff}명</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 전체 요약 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-blue-600 text-xs mb-1">총 배치</div>
                  <div className="font-bold text-lg">{report.summary.totalAssignments}건</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-600 text-xs mb-1">평균 편차</div>
                  <div className="font-bold text-lg">{report.summary.averageFairness}</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-600 text-xs mb-1">유연 배치</div>
                  <div className="font-bold text-lg">{report.summary.totalFlexibleAssignments}건</div>
                </div>
                <div className="text-center">
                  <div className="text-blue-600 text-xs mb-1">전체 직원</div>
                  <div className="font-bold text-lg">{report.summary.totalStaff}명</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 하단 버튼 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} size="lg" disabled={assigning}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전 단계
        </Button>
        <Button onClick={onNext} size="lg" disabled={!preview && !hasExistingAssignments}>
          다음 단계
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
