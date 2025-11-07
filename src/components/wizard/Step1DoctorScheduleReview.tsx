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
import { isInPreviousMonth, isInNextMonth } from '@/lib/date-utils'

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
  isClosed?: boolean
}

interface WeeklyPattern {
  id: string
  name: string
}

interface WeekPatternInfo {
  weekNumber: number
  patternId: string
  patternName: string
}

export default function Step1DoctorScheduleReview({ wizardState, updateWizardState, onNext }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [doctorSchedules, setDoctorSchedules] = useState<DoctorScheduleSummary[]>([])
  const [slots, setSlots] = useState<SlotSummary[]>([])
  const [hasSchedule, setHasSchedule] = useState(false)
  const [regularClosedDays, setRegularClosedDays] = useState<number[]>([]) // 정기 휴무일
  const [weekPatterns, setWeekPatterns] = useState<WeekPatternInfo[]>([]) // 주차별 패턴 정보
  const [allPatterns, setAllPatterns] = useState<WeeklyPattern[]>([]) // 전체 패턴 목록

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

      // 전체 패턴 목록 조회
      const patternsResponse = await fetch('/api/settings/weekly-patterns', { cache: 'no-store' })
      const patternsData = await patternsResponse.json()
      if (patternsData.success && patternsData.data) {
        setAllPatterns(patternsData.data)
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

        // 기존 스케줄의 weekPatterns를 wizard 상태에 저장 및 표시용 데이터 생성
        if (data.weekPatterns) {
          console.log('Loading weekPatterns from schedule:', data.weekPatterns)
          updateWizardState({ weeklyPatterns: data.weekPatterns })

          // 전체 패턴 목록에서 패턴명 찾기
          const patterns = patternsData.success && patternsData.data ? patternsData.data : []
          console.log('Available patterns for mapping:', patterns)

          // weekPatterns 객체를 배열로 변환하고 패턴명 추가
          const weekPatternArray: WeekPatternInfo[] = Object.entries(data.weekPatterns as Record<string, string>)
            .map(([weekNum, patternId]) => {
              const pattern = patterns.find((p: WeeklyPattern) => p.id === patternId)
              console.log(`Week ${weekNum}: patternId=${patternId}, found=${pattern ? pattern.name : 'NOT FOUND'}`)
              return {
                weekNumber: parseInt(weekNum),
                patternId: patternId as string,
                patternName: pattern?.name || '알 수 없음'
              }
            })
            .sort((a, b) => a.weekNumber - b.weekNumber)

          console.log('Final weekPatternArray:', weekPatternArray)
          setWeekPatterns(weekPatternArray)
        } else {
          setWeekPatterns([])
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

  // 그리드 컬럼 클래스 - 주 단위(일~토) 7칸 고정
  const getGridColsClass = () => {
    return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7'
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

                {/* 주차별 패턴 정보 */}
                {weekPatterns.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">주차별 패턴</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {weekPatterns.map((wp) => (
                        <div key={wp.weekNumber} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-blue-700">
                              {wp.weekNumber}주차
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-blue-900">
                            {wp.patternName}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 슬롯 현황 - 달력 형태 */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">일별 슬롯 현황 (주 단위)</h4>
                  <div className={`grid ${getGridColsClass()} gap-3`}>
                    {slots.map((slot) => {
                        const dateObj = new Date(slot.date)
                        const day = dateObj.getDate()
                        const isClosed = (slot as any).isClosed || false
                        const isLowSlots = slot.availableSlots < 3

                        // 이전/다음 달 여부 확인
                        const isPrevMonth = isInPreviousMonth(dateObj, wizardState.year, wizardState.month)
                        const isNextMonth = isInNextMonth(dateObj, wizardState.year, wizardState.month)
                        const isOtherMonth = isPrevMonth || isNextMonth

                        return (
                          <div
                            key={slot.date}
                            className={`border rounded-lg p-3 transition-all ${
                              isClosed
                                ? 'bg-gray-100 border-gray-300 opacity-60'
                                : isOtherMonth
                                ? 'bg-blue-50 border-blue-300 opacity-75'
                                : isLowSlots
                                ? 'bg-amber-50 border-amber-200 hover:shadow-md'
                                : 'bg-gray-50 border-gray-200 hover:shadow-md'
                            }`}
                          >
                            {/* 날짜 헤더 */}
                            <div className="flex items-center justify-between mb-2">
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  isClosed
                                    ? 'bg-gray-200 text-gray-600 border-gray-400'
                                    : isOtherMonth
                                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                                    : ''
                                }`}
                              >
                                {slot.dayOfWeek}
                              </Badge>
                              <div className="flex flex-col items-end">
                                {isOtherMonth ? (
                                  <>
                                    <span className={`font-bold text-sm ${isClosed ? 'text-gray-500' : 'text-blue-700'}`}>
                                      {dateObj.getMonth() + 1}월 {day}일
                                    </span>
                                    <span className={`text-xs ${isClosed ? 'text-gray-500' : 'text-blue-600'}`}>
                                      {isPrevMonth ? '이전달' : '다음달'}
                                    </span>
                                  </>
                                ) : (
                                  <span className={`font-bold text-lg ${isClosed ? 'text-gray-500' : ''}`}>
                                    {day}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 휴무일 표시 또는 원장 정보 */}
                            {isClosed ? (
                              <div className="text-center py-6">
                                <span className="text-sm font-medium text-gray-500">휴무</span>
                              </div>
                            ) : (
                              <>
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
                                    isOtherMonth ? 'text-blue-600' : isLowSlots ? 'text-amber-700' : 'text-green-600'
                                  }`}>
                                    슬롯 {slot.availableSlots}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                  </div>

                  {/* 정기 휴무일 정보 표시 */}
                  {regularClosedDays.length > 0 && (
                    <div className="mt-4 text-xs text-gray-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>
                        정기 휴무일({regularClosedDays.map(d => ['일', '월', '화', '수', '목', '금', '토'][d]).join(', ')})은 회색으로 표시됩니다
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
