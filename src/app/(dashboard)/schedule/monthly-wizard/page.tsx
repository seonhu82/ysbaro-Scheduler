/**
 * 월간 스케줄 생성 마법사
 * 4단계 프로세스:
 * 1. 월 선택 및 주간 패턴 배정
 * 2. 연차/오프 확인 및 ON_HOLD 처리
 * 3. 자동 배정 및 미리보기
 * 4. 확인 및 배포
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { Calendar, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'

// Step components
import Step1DoctorScheduleReview from '@/components/wizard/Step1DoctorScheduleReview'
import Step2LeaveConfirmation from '@/components/wizard/Step2LeaveConfirmation'
import Step3AutoAssignment from '@/components/wizard/Step3AutoAssignment'
import Step4Deployment from '@/components/wizard/Step4Deployment'

interface WizardState {
  year: number
  month: number
  weeklyPatterns: { [weekNumber: string]: string } // weekNumber -> patternId
  leaveApplications: any[]
  assignmentResult: any
  schedule: any
}

export default function MonthlyWizardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [wizardState, setWizardState] = useState<WizardState>({
    year: parseInt(searchParams.get('year') || new Date().getFullYear().toString()),
    month: parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString()),
    weeklyPatterns: {},
    leaveApplications: [],
    assignmentResult: null,
    schedule: null
  })

  // 페이지 로드 시 기존 스케줄 확인 및 적절한 단계로 이동
  useEffect(() => {
    const checkExistingSchedule = async () => {
      try {
        setLoading(true)

        // 스케줄 상태 조회
        const scheduleResponse = await fetch(
          `/api/schedule/status?year=${wizardState.year}&month=${wizardState.month}`
        )
        const scheduleStatus = await scheduleResponse.json()

        if (!scheduleStatus.success || !scheduleStatus.schedule) {
          // 스케줄이 없으면 Step 1부터 시작
          console.log('스케줄 없음, Step 1부터 시작')
          setCurrentStep(1)
          setLoading(false)
          return
        }

        const schedule = scheduleStatus.schedule

        // 이미 배포된 스케줄인 경우 4단계로 이동하여 안내 표시
        if (schedule.status === 'DEPLOYED') {
          console.log('이미 배포된 스케줄입니다. Step 4로 이동합니다.')
          setCurrentStep(4)
          updateWizardState({
            schedule,
            assignmentResult: { scheduleId: schedule.id }
          })
          setLoading(false)
          return
        }

        // 원장 스케줄 조회 (DRAFT, CONFIRMED 상태)
        const hasDoctorSchedule = schedule.status === 'DRAFT' || schedule.status === 'CONFIRMED'

        // 직원 배치 조회 (staff-stats API 사용)
        console.log(`🔍 직원 배치 조회: /api/schedule/staff-stats?year=${wizardState.year}&month=${wizardState.month}&status=${schedule.status}`)
        const staffStatsResponse = await fetch(
          `/api/schedule/staff-stats?year=${wizardState.year}&month=${wizardState.month}&status=${schedule.status}`
        )
        const staffStatsData = await staffStatsResponse.json()
        console.log('🔍 staff-stats 응답:', staffStatsData)

        // 직원 배치 여부 확인 (stats 배열에 totalDays > 0인 직원이 있는지)
        const hasStaffAssignment = staffStatsData.success &&
          staffStatsData.data?.stats?.some((stat: any) => stat.totalDays > 0)
        console.log('🔍 직원 배치 여부:', hasStaffAssignment)

        // 단계 결정
        if (!hasDoctorSchedule) {
          // 원장 스케줄 없음 -> Step 1
          console.log('원장 스케줄 없음, Step 1부터 시작')
          setCurrentStep(1)
        } else if (!hasStaffAssignment) {
          // 원장 스케줄만 있고 직원 배치 없음 -> Step 1부터 시작
          console.log('원장 스케줄만 있음, Step 1부터 시작')
          setCurrentStep(1)
          updateWizardState({
            assignmentResult: { scheduleId: schedule.id }
          })
        } else {
          // 직원 배치까지 있음 (배포 전) -> Step 4 (배포)
          console.log('직원 배치 완료, Step 4로 이동')
          setCurrentStep(4)
          updateWizardState({
            assignmentResult: { scheduleId: schedule.id }
          })
        }
      } catch (error) {
        console.error('Failed to check existing schedule:', error)
        setCurrentStep(1)
      } finally {
        setLoading(false)
      }
    }

    checkExistingSchedule()
  }, [wizardState.year, wizardState.month])

  const steps = [
    { number: 1, title: '원장 스케줄 확인', description: '배치된 원장 스케줄 및 슬롯 확인' },
    { number: 2, title: '연차/오프 확인', description: '신청 내역 검토 및 ON_HOLD 처리' },
    { number: 3, title: '자동 배정 및 미리보기', description: '형평성 기반 자동 배정 실행' },
    { number: 4, title: '확인 및 배포', description: '최종 확인 후 스케줄 배포' }
  ]

  const updateWizardState = (updates: Partial<WizardState>) => {
    setWizardState(prev => ({ ...prev, ...updates }))
  }

  const goToNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleComplete = () => {
    toast({
      title: '스케줄 배포 완료!',
      description: `${wizardState.year}년 ${wizardState.month}월 스케줄이 성공적으로 배포되었습니다.`
    })
    router.push('/calendar')
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1DoctorScheduleReview
            wizardState={wizardState}
            updateWizardState={updateWizardState}
            onNext={goToNextStep}
          />
        )
      case 2:
        return (
          <Step2LeaveConfirmation
            wizardState={wizardState}
            updateWizardState={updateWizardState}
            onNext={goToNextStep}
            onBack={goToPrevStep}
          />
        )
      case 3:
        return (
          <Step3AutoAssignment
            wizardState={wizardState}
            updateWizardState={updateWizardState}
            onNext={goToNextStep}
            onBack={goToPrevStep}
          />
        )
      case 4:
        return (
          <Step4Deployment
            wizardState={wizardState}
            updateWizardState={updateWizardState}
            onComplete={handleComplete}
            onBack={goToPrevStep}
          />
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">스케줄 확인 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Calendar className="w-8 h-8" />
          직원 스케줄 배치
        </h1>
        <p className="text-gray-600">
          {wizardState.year}년 {wizardState.month}월 직원 스케줄을 자동으로 생성합니다
        </p>
      </div>

      {/* 진행 상황 표시 */}
      <Card className="mb-6">
          <CardContent className="p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  단계 {currentStep} / 4
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round((currentStep / 4) * 100)}% 완료
                </span>
              </div>
              <Progress value={(currentStep / 4) * 100} className="h-2" />
            </div>

          {/* 단계 표시 */}
          <div className="relative">
            {/* 연결선 배경 */}
            <div className="hidden md:block absolute top-6 left-0 right-0 h-0.5 bg-gray-200" style={{ left: "3rem", right: "3rem" }} />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
              {steps.map((step, index) => (
                <div key={step.number} className="relative">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-4 border-white ${
                        currentStep > step.number
                          ? 'bg-green-500 text-white'
                          : currentStep === step.number
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                      style={{ position: "relative", zIndex: 10 }}
                    >
                      {currentStep > step.number ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold bg-white px-1" style={{ position: 'relative', zIndex: 10 }}>
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 bg-white px-1" style={{ position: 'relative', zIndex: 10 }}>
                        {step.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 현재 단계 컨텐츠 */}
      {renderStep()}
    </div>
  )
}
