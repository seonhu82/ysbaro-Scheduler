/**
 * Step 1: 원장 스케줄 확인 및 슬롯 확인
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, AlertCircle, ArrowRight, CheckCircle2, Users, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  wizardState: any
  updateWizardState: (updates: any) => void
  onNext: () => void
}

interface DoctorScheduleSummary {
  doctorName: string
  totalDays: number
  nightShifts: number
}

interface SlotSummary {
  date: string
  dayOfWeek: string
  doctors: string[]
  hasNightShift: boolean
  requiredStaff: number
  availableSlots: number
}

export default function Step1DoctorScheduleReview({ wizardState, updateWizardState, onNext }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [doctorSchedules, setDoctorSchedules] = useState<DoctorScheduleSummary[]>([])
  const [slots, setSlots] = useState<SlotSummary[]>([])
  const [hasSchedule, setHasSchedule] = useState(false)
  const [regularClosedDays, setRegularClosedDays] = useState<number[]>([]) // 정기 휴무일

  useEffect(() => {
    loadDoctorSchedule()
  }, [wizardState.year, wizardState.month])

  // 페이지가 포커스를 받을 때 자동으로 다시 로드
  useEffect(() => {
    const handleFocus = () => {
      console.log('Page focused, reloading doctor schedule...')
      loadDoctorSchedule()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [wizardState.year, wizardState.month])

  const loadDoctorSchedule = async () => {
    try {
      setLoading(true)

      // 정기 휴무일 설정 조회
      const closedDaysResponse = await fetch('/api/settings/holidays', { cache: 'no-store' })
      const closedDaysData = await closedDaysResponse.json()
      console.log('Closed days API response:', closedDaysData)
      if (closedDaysData.success && closedDaysData.data?.settings) {
        const regularDays = closedDaysData.data.settings.regularDays || []
        console.log('Regular closed days:', regularDays)
        setRegularClosedDays(Array.isArray(regularDays) ? regularDays : [])
      }

      // 원장 스케줄 조회
      const response = await fetch(
        `/api/schedule/doctor-summary?year=${wizardState.year}&month=${wizardState.month}`,
        { cache: 'no-store' }
      )
      const data = await response.json()

      console.log('Doctor schedule API response:', data)

      if (data.success) {
        console.log('Doctor schedules:', data.doctorSchedules)
        console.log('Slots:', data.slots)
        console.log('Slots by dayOfWeek:', data.slots?.map((s: any) => ({ date: s.date, dayOfWeek: s.dayOfWeek })))
        setDoctorSchedules(data.doctorSchedules || [])
        setSlots(data.slots || [])
        setHasSchedule(data.hasSchedule || false)

        // 기존 스케줄의 weekPatterns를 wizard 상태에 저장
        if (data.weekPatterns) {
          console.log('Loading weekPatterns from schedule:', data.weekPatterns)
          updateWizardState({ weeklyPatterns: data.weekPatterns })
        }
      } else {
        console.error('API returned success: false', data)
      }
    } catch (error) {
      console.error('Failed to load doctor schedule:', error)
      toast({
        variant: 'destructive',
        title: '스케줄 로드 실패',
        description: '원장 스케줄을 불러올 수 없습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (!hasSchedule) {
      toast({
        variant: 'destructive',
        title: '원장 스케줄 필요',
        description: '먼저 원장 스케줄을 배치해주세요'
      })
      return
    }

    onNext()
  }

  // 영업일 수 계산 (7일 - 정기 휴무일 수)
  const workingDaysCount = 7 - regularClosedDays.length

  // 그리드 컬럼 클래스 동적 생성
  const getGridColsClass = () => {
    // 모바일: 2칸 고정
    // 태블릿(md): 영업일이 5일 이하면 그대로, 6일 이상이면 4칸
    // 데스크탑(lg): 영업일이 5일이면 5칸, 6일이면 6칸, 7일이면 7칸
    if (workingDaysCount === 7) {
      return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7'
    } else if (workingDaysCount === 6) {
      return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
    } else if (workingDaysCount === 5) {
      return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
    } else {
      // 4일 이하
      return `grid-cols-2 md:grid-cols-3 lg:grid-cols-${workingDaysCount}`
    }
  }

  return (
    <div className="space-y-6">
      {/* 월 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              1단계: 원장 스케줄 확인
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDoctorSchedule}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 연도/월 선택 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">연도</label>
              <Select
                value={wizardState.year.toString()}
                onValueChange={(value) => updateWizardState({ year: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">월</label>
              <Select
                value={wizardState.month.toString()}
                onValueChange={(value) => updateWizardState({ month: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <SelectItem key={month} value={month.toString()}>
                      {month}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 원장 스케줄 상태 */}
          <div className="border-t pt-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">로딩 중...</div>
            ) : !hasSchedule ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-600" />
                <p className="font-semibold text-amber-900 mb-2">
                  원장 스케줄이 없습니다
                </p>
                <p className="text-sm text-amber-700 mb-4">
                  먼저 "원장 스케줄 배치" 메뉴에서 원장 스케줄을 배치해주세요
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/schedule/auto-assign'}
                >
                  원장 스케줄 배치 페이지로 이동
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-700 mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">원장 스케줄 배치 완료</span>
                </div>

                {/* 원장별 근무 요약 */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">원장별 근무 요약</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {doctorSchedules.map((schedule) => (
                      <div key={schedule.doctorName} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{schedule.doctorName}</span>
                          <Badge variant="outline">{schedule.totalDays}일</Badge>
                        </div>
                        {schedule.nightShifts > 0 && (
                          <div className="text-xs text-gray-600">
                            야간: {schedule.nightShifts}회
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 슬롯 현황 - 달력 형태 */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">일별 슬롯 현황</h4>
                  <div className={`grid ${getGridColsClass()} gap-3`}>
                    {slots
                      .filter((slot) => {
                        // 정기 휴무일 필터링
                        const dayOfWeekMap: Record<string, number> = {
                          '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6
                        }
                        const dayNum = dayOfWeekMap[slot.dayOfWeek]
                        return !regularClosedDays.includes(dayNum)
                      })
                      .map((slot) => {
                        const dateObj = new Date(slot.date)
                        const day = dateObj.getDate()
                        const isLowSlots = slot.availableSlots < 3

                        return (
                          <div
                            key={slot.date}
                            className={`border rounded-lg p-3 transition-all hover:shadow-md ${
                              isLowSlots
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            {/* 날짜 헤더 */}
                            <div className="flex items-center justify-between mb-2">
                              <Badge
                                variant="outline"
                                className="text-xs"
                              >
                                {slot.dayOfWeek}
                              </Badge>
                              <span className="font-bold text-lg">{day}</span>
                            </div>

                            {/* 원장 정보 */}
                            <div className="text-xs text-gray-600 mb-2 line-clamp-2">
                              {slot.doctors.join(', ')}
                            </div>

                            {/* 야간 뱃지 (공간 고정) */}
                            <div className="h-6 mb-2">
                              {slot.hasNightShift && (
                                <Badge
                                  variant="outline"
                                  className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                                >
                                  야간
                                </Badge>
                              )}
                            </div>

                            {/* 슬롯 정보 */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t">
                              <div className="text-xs text-gray-500">
                                필요 {slot.requiredStaff}
                              </div>
                              <div className={`text-xs font-semibold ${
                                isLowSlots ? 'text-amber-700' : 'text-green-600'
                              }`}>
                                슬롯 {slot.availableSlots}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>

                  {/* 정기 휴무일 정보 표시 */}
                  {regularClosedDays.length > 0 && (
                    <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>
                        정기 휴무일({regularClosedDays.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')})은 표시하지 않습니다
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 다음 버튼 */}
          {hasSchedule && (
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleNext} size="lg">
                다음 단계
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
