/**
 * Step 3: 자동 배정 및 미리보기
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Zap, AlertTriangle, ArrowRight, ArrowLeft, Users, TrendingUp } from 'lucide-react'
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
          {!preview ? (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <Zap className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-purple-700">
                    <p className="font-medium mb-1">자동 배정 알고리즘</p>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>형평성 우선: 야간/주말/공휴일 근무를 고르게 분배</li>
                      <li>카테고리별 필수 인원 충족</li>
                      <li>직원 선호도 및 패턴 고려</li>
                      <li>연차/오프 자동 반영</li>
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
                  <div className="flex items-center gap-2 text-green-700">
                    <TrendingUp className="w-5 h-5" />
                    <p className="font-medium">자동 배정이 완료되었습니다</p>
                  </div>
                  <p className="text-sm text-green-600 mt-2">
                    다음 단계에서 최종 확인 후 배포할 수 있습니다
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 하단 버튼 */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} size="lg" disabled={assigning}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전 단계
        </Button>
        <Button onClick={onNext} size="lg" disabled={!preview}>
          다음 단계
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
