'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle } from 'lucide-react'

// 단계별 컴포넌트 import
import { ClinicInfoStep } from '@/components/setup/ClinicInfoStep'
import { DepartmentCategoryStep } from '@/components/setup/DepartmentCategoryStep'
import { DoctorInfoStep } from '@/components/setup/DoctorInfoStep'
import { StaffRegistrationStep } from '@/components/setup/StaffRegistrationStep'
import { CombinationStep } from '@/components/setup/CombinationStep'
import { ClosedDayStep } from '@/components/setup/ClosedDayStep'

interface SetupData {
  // 1단계: 병원 정보
  clinicInfo: {
    name: string
    address: string
    phone: string
  }

  // 2단계: 부서/구분
  departments: { name: string; order: number }[]
  categories: { name: string; priority: number; order: number }[]

  // 3단계: 원장 정보
  doctors: {
    name: string
    useCategory: boolean
    categories: string[]
  }[]

  // 4단계: 직원
  staff: {
    name: string
    birthDate: string
    departmentName: string
    categoryName: string
    position: string
    workType: 'WEEK_4' | 'WEEK_5'
  }[]

  // 5단계: 조합
  combinations: {
    name: string
    dayOfWeek: string
    requiredStaff: number
    doctors: string[]
  }[]

  // 6단계: 휴업일
  closedDays: {
    includeHolidays: boolean
    years: number[]
    regularDays: {
      dayOfWeek: number
      weekOfMonth: number
    }[]
    specificDates: string[]
  }

  // 형평성 설정
  fairness: {
    enabled: boolean
    includeHolidays: boolean
  }
}

const STEPS = [
  { id: 1, name: '병원 정보', description: '기본 정보 입력' },
  { id: 2, name: '부서/구분', description: '부서 및 직원 구분 설정' },
  { id: 3, name: '원장 정보', description: '원장 정보 및 구분 설정' },
  { id: 4, name: '직원 등록', description: '직원 정보 입력' },
  { id: 5, name: '의사 조합', description: '일 패턴 설정' },
  { id: 6, name: '휴업일', description: '휴업일 설정' },
]

export default function InitialSetupPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [setupData, setSetupData] = useState<SetupData>({
    clinicInfo: { name: '', address: '', phone: '' },
    departments: [
      { name: '데스크', order: 0 },
      { name: '진료실', order: 1 },
    ],
    categories: [
      { name: '팀장/실장', priority: 1, order: 0 },
      { name: '고년차', priority: 2, order: 1 },
      { name: '중간년차', priority: 3, order: 2 },
      { name: '저년차', priority: 4, order: 3 },
    ],
    doctors: [],
    staff: [],
    combinations: [],
    closedDays: {
      includeHolidays: false,
      years: [],
      regularDays: [],
      specificDates: [],
    },
    fairness: {
      enabled: true,
      includeHolidays: false,
    },
  })

  // 데이터 변경 시 localStorage에 자동 저장 (초기 로드 후에만)
  useEffect(() => {
    if (!isInitialLoad && typeof window !== 'undefined') {
      localStorage.setItem('setupData', JSON.stringify(setupData))
      console.log('Setup data saved to localStorage')
    }
  }, [setupData, isInitialLoad])
  
  // 단계 변경 시 저장
  useEffect(() => {
    if (!isInitialLoad && typeof window !== 'undefined') {
      localStorage.setItem('setupStep', currentStep.toString())
      console.log('Current step saved:', currentStep)
    }
  }, [currentStep, isInitialLoad])

  // 페이지 로드 시 저장된 데이터 복원 (먼저 실행되도록)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem('setupData')
      const savedStep = localStorage.getItem('setupStep')
      
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData)
          setSetupData(parsed)
        } catch (error) {
          console.error('Failed to restore setup data:', error)
        }
      }
      
      if (savedStep) {
        try {
          setCurrentStep(parseInt(savedStep))
        } catch (error) {
          console.error('Failed to restore step:', error)
        }
      }
      
      // 초기 로드 완료
      setIsInitialLoad(false)
    }
  }, [])

  const progress = (currentStep / STEPS.length) * 100

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      // 현재 페이지 데이터가 localStorage에 저장됨 (useEffect)
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    try {
      // API 호출하여 설정 저장
      const response = await fetch('/api/setup/initial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupData),
      })

      if (response.ok) {
        // 설정 완료 후 localStorage 데이터 삭제
        if (typeof window !== 'undefined') {
          localStorage.removeItem('setupData')
        }
        router.push('/calendar')
        router.refresh()
      }
    } catch (error) {
      console.error('Setup error:', error)
    }
  }

  const updateSetupData = (step: keyof SetupData, data: any) => {
    setSetupData((prev) => ({
      ...prev,
      [step]: data,
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">초기 설정</h1>
          <p className="text-gray-600">
            시스템 사용을 위한 기본 설정을 진행합니다
          </p>
        </div>

        {/* 진행률 바 */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              진행률: {Math.round(progress)}%
            </span>
            <span className="text-sm text-gray-600">
              {currentStep} / {STEPS.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* 단계 표시 */}
        <div className="flex justify-between mb-8 overflow-x-auto pb-4">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className="flex flex-col items-center min-w-[120px]"
            >
              <div className="flex items-center">
                {currentStep > step.id ? (
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                ) : currentStep === step.id ? (
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                    {step.id}
                  </div>
                ) : (
                  <Circle className="w-8 h-8 text-gray-300" />
                )}
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-16 h-0.5 mx-2 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
              <div className="text-center mt-2">
                <p className="text-sm font-medium text-gray-900">
                  {step.name}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 단계별 컨텐츠 */}
        <Card className="mb-6 shadow-xl">
          <CardContent className="p-8">
            {currentStep === 1 && (
              <ClinicInfoStep
                data={setupData.clinicInfo}
                onChange={(data) => updateSetupData('clinicInfo', data)}
              />
            )}
            {currentStep === 2 && (
              <DepartmentCategoryStep
                departments={setupData.departments}
                categories={setupData.categories}
                onDepartmentsChange={(data) =>
                  updateSetupData('departments', data)
                }
                onCategoriesChange={(data) =>
                  updateSetupData('categories', data)
                }
              />
            )}
            {currentStep === 3 && (
              <DoctorInfoStep
                data={setupData.doctors}
                onChange={(data) => updateSetupData('doctors', data)}
              />
            )}
            {currentStep === 4 && (
              <StaffRegistrationStep
                data={setupData.staff}
                departments={setupData.departments}
                categories={setupData.categories}
                onChange={(data) => updateSetupData('staff', data)}
              />
            )}
            {currentStep === 5 && (
              <CombinationStep
                data={setupData.combinations}
                doctors={setupData.doctors}
                fairness={setupData.fairness}
                onChange={(data) => updateSetupData('combinations', data)}
                onFairnessChange={(data) => updateSetupData('fairness', data)}
              />
            )}
            {currentStep === 6 && (
              <ClosedDayStep
                data={setupData.closedDays}
                onChange={(data) => updateSetupData('closedDays', data)}
              />
            )}
          </CardContent>
        </Card>

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="px-8"
          >
            ← 이전
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              onClick={handleNext}
              className="px-8 bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              다음 단계 →
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              className="px-8 bg-gradient-to-r from-green-600 to-emerald-600"
            >
              ✓ 완료
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
