/**
 * 주간 패턴 드래그앤드롭 빌더
 *
 * 기능:
 * - 좌측: 사용 가능한 패턴 목록
 * - 우측: 주차별 슬롯 (드롭 영역)
 * - 드래그앤드롭으로 패턴 할당
 * - 일괄 적용 기능
 */

'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Calendar, Copy, Trash2, Lock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DailyPattern {
  dayOfWeek: number
  combination?: {
    name: string
    doctors: string[]
    hasNightShift: boolean
  }
}

interface WeeklyPattern {
  id: string
  name: string
  description?: string
  dailyPatternCount?: number
  dailyPatterns?: DailyPattern[]
}

interface WeekAssignment {
  weekNumber: number
  weekLabel: string
  patternId: string | null
  patternName: string | null
  isDeployed?: boolean  // 이미 배포된 주차인지 여부
  deployedFrom?: string // 어느 스케줄에서 배포되었는지 (예: "2024년 10월")
}

interface Props {
  year: number
  month: number
  onPatternsAssigned: (assignments: { weekNumber: number; patternId: string }[]) => void
}

export default function WeeklyPatternBuilder({ year, month, onPatternsAssigned }: Props) {
  const { toast } = useToast()
  const [patterns, setPatterns] = useState<WeeklyPattern[]>([])
  const [weekAssignments, setWeekAssignments] = useState<WeekAssignment[]>([])
  const [activePattern, setActivePattern] = useState<WeeklyPattern | null>(null)
  const [loading, setLoading] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const initializeData = async () => {
      const loadedPatterns = await loadPatterns()
      await loadExistingSchedule(loadedPatterns)
    }
    initializeData()
  }, [year, month])

  useEffect(() => {
    // 할당 변경 시 부모에게 알림
    const assignments = weekAssignments
      .filter(w => w.patternId)
      .map(w => ({ weekNumber: w.weekNumber, patternId: w.patternId! }))
    onPatternsAssigned(assignments)
  }, [weekAssignments]) // onPatternsAssigned 제거하여 무한 루프 방지

  const loadPatterns = async () => {
    try {
      const response = await fetch('/api/settings/weekly-patterns')
      const result = await response.json()

      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        // 활성화된 패턴만 필터링
        const activePatterns = result.data.filter((pattern: any) => pattern.isActive !== false)
        setPatterns(activePatterns)
        return activePatterns
      } else {
        setPatterns([])
        return []
      }
    } catch (error) {
      console.error('Failed to load patterns:', error)
      toast({
        variant: 'destructive',
        title: '패턴 로드 실패',
        description: '주간 패턴을 불러올 수 없습니다'
      })
      return []
    }
  }

  const initializeWeeks = () => {
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)
    const weeks = getWeeksInMonth(monthStart, monthEnd)

    setWeekAssignments(
      weeks.map((week, index) => ({
        weekNumber: index + 1,
        weekLabel: `${week.start.getMonth() + 1}/${week.start.getDate()} - ${week.end.getMonth() + 1}/${week.end.getDate()}`,
        patternId: null,
        patternName: null
      }))
    )
  }

  const loadExistingSchedule = async (loadedPatterns?: any[]) => {
    try {
      setLoading(true)

      const patternsToUse = loadedPatterns || patterns

      // 1. 이전 달에 배포된 스케줄 확인 (다음 달로 걸쳐있는지)
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year

      const prevDeployedResponse = await fetch(
        `/api/schedule/doctor-summary?year=${prevYear}&month=${prevMonth}`
      )
      const prevDeployedData = await prevDeployedResponse.json()

      console.log('[WeeklyPatternBuilder] Previous month deployed schedule:', prevDeployedData)

      // 2. 기존 스케줄 조회
      const response = await fetch(`/api/schedule/doctor-summary?year=${year}&month=${month}`)
      const data = await response.json()

      console.log('[WeeklyPatternBuilder] Doctor summary response:', data)

      // 3. ClosedDaySettings 조회
      const closedDaysResponse = await fetch('/api/settings/holidays')
      const closedDaysData = await closedDaysResponse.json()
      const closedDays = closedDaysData.success ? closedDaysData.data?.settings : null

      console.log('[WeeklyPatternBuilder] Closed days settings:', closedDays)

      // 4. 주차 정보 생성 (휴무일 정보 포함)
      const monthStart = new Date(year, month - 1, 1)
      const monthEnd = new Date(year, month, 0)
      const weeks = getWeeksInMonthFiltered(monthStart, monthEnd, closedDays)

      // 4. 이전 달 배포 범위 확인 및 현재 월의 실제 배포 데이터 확인
      let deployedDateRange: { start: Date; end: Date } | null = null
      const prevWeekPatterns = prevDeployedData.success && prevDeployedData.weekPatterns
        ? prevDeployedData.weekPatterns
        : {}

      // 현재 스케줄의 배포 상태 확인
      const isCurrentMonthDeployed = data.schedule?.status === 'DEPLOYED'

      // 이전 달에서 현재 달로 걸쳐진 배포 주차 계산
      let deployedWeeksFromPrevMonth: number[] = []

      if (prevDeployedData.success && prevDeployedData.schedule?.deployedEndDate) {
        const deployedEnd = new Date(prevDeployedData.schedule.deployedEndDate)
        const currentMonthStart = new Date(year, month - 1, 1)
        const currentMonthEnd = new Date(year, month, 0)

        console.log(`[WeeklyPatternBuilder] 이전 달 배포 종료일 체크:`, {
          deployedEnd: deployedEnd.toISOString().split('T')[0],
          currentMonth: `${year}-${month}`,
          currentMonthStart: currentMonthStart.toISOString().split('T')[0],
          currentMonthEnd: currentMonthEnd.toISOString().split('T')[0],
          isCurrentMonthDeployed
        })

        // 이전 달 배포가 현재 월로 걸쳐있는 경우에만 영향
        if (deployedEnd >= currentMonthStart) {
          // 배포 종료일이 현재 월 시작일 이후면 현재 월이 영향받음
          deployedDateRange = {
            start: currentMonthStart,
            end: deployedEnd > currentMonthEnd ? currentMonthEnd : deployedEnd
          }

          // 영향받는 주차 계산
          weeks.forEach((week, index) => {
            if (week.start <= deployedEnd) {
              deployedWeeksFromPrevMonth.push(index + 1)
            }
          })

          console.log(`[WeeklyPatternBuilder] ✅ 이전 달 배포가 현재 달로 걸쳐짐: ${deployedDateRange.start.toISOString().split('T')[0]} ~ ${deployedDateRange.end.toISOString().split('T')[0]}`)
          console.log(`[WeeklyPatternBuilder] 영향받는 주차:`, deployedWeeksFromPrevMonth)
          console.log(`[WeeklyPatternBuilder] Previous month weekPatterns:`, prevWeekPatterns)
        } else {
          console.log(`[WeeklyPatternBuilder] ⏭️ 이전 달 배포 종료일이 현재 월 이전임 (영향 없음)`)
        }
      }

      // 5. weekPatterns가 있으면 바로 사용
      const savedWeekPatterns = data.success && data.hasSchedule ? (data.weekPatterns || {}) : {}
      console.log('[WeeklyPatternBuilder] Saved weekPatterns:', savedWeekPatterns)

      // 6. 주차별 배정 정보 생성 (배포 여부 체크)
      const weekAssignmentsWithPattern = weeks.map((week, index) => {
        const weekNumber = index + 1

        // 이 주차가 배포되어 수정 불가능한지 확인:
        // 1. 현재 달이 배포된 상태이거나
        // 2. 이전 달 배포가 이 주차까지 걸쳐있는 경우
        const isDeployed = isCurrentMonthDeployed || deployedWeeksFromPrevMonth.includes(weekNumber)

        // 배포된 주차라면 이전 달의 패턴 사용, 아니면 현재 달의 패턴 사용
        const patternId = deployedWeeksFromPrevMonth.includes(weekNumber)
          ? (prevWeekPatterns[weekNumber] || null)
          : (savedWeekPatterns[weekNumber] || null)

        const pattern = patternsToUse.find(p => p.id === patternId)

        return {
          weekNumber,
          weekLabel: `${week.start.getMonth() + 1}/${week.start.getDate()} - ${week.end.getMonth() + 1}/${week.end.getDate()}`,
          patternId: patternId,
          patternName: pattern?.name || null,
          isDeployed,
          deployedFrom: deployedWeeksFromPrevMonth.includes(weekNumber) ? `${prevYear}년 ${prevMonth}월` : undefined
        }
      })

      setWeekAssignments(weekAssignmentsWithPattern)

      const assignedWeeks = weekAssignmentsWithPattern.filter(w => w.patternId).length
      const deployedWeeks = weekAssignmentsWithPattern.filter(w => w.isDeployed).length

      if (deployedWeeks > 0) {
        toast({
          title: '배포된 스케줄 안내',
          description: `${deployedWeeks}개 주차가 이미 배포되었습니다. 수정 시 재배포가 필요합니다.`,
          variant: 'default'
        })
      } else if (assignedWeeks > 0) {
        toast({
          title: '기존 스케줄 로드 완료',
          description: `${year}년 ${month}월 주차별 패턴 설정 로드 완료 (${assignedWeeks}개 주차)`
        })
      } else {
        console.log('[WeeklyPatternBuilder] No saved weekPatterns')
      }
    } catch (error) {
      console.error('Failed to load existing schedule:', error)
      // 오류 시 빈 주차로 초기화
      initializeWeeks()
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const pattern = patterns.find(p => p.id === event.active.id)
    setActivePattern(pattern || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActivePattern(null)

    if (!over) return

    // 주차 슬롯에 드롭한 경우
    if (over.id.toString().startsWith('week-')) {
      const weekNumber = parseInt(over.id.toString().replace('week-', ''))
      const targetWeek = weekAssignments.find(w => w.weekNumber === weekNumber)

      // 배포된 주차에 대한 경고
      if (targetWeek?.isDeployed) {
        toast({
          variant: 'default',
          title: '배포된 주차 수정',
          description: `${weekNumber}주차는 이미 배포되었습니다. 수정 후 재배포가 필요합니다.`
        })
      }

      const patternId = active.id.toString()
      const pattern = patterns.find(p => p.id === patternId)

      if (pattern) {
        setWeekAssignments(prev =>
          prev.map(w =>
            w.weekNumber === weekNumber
              ? { ...w, patternId: pattern.id, patternName: pattern.name }
              : w
          )
        )

        toast({
          title: '패턴 할당 완료',
          description: `${weekNumber}주차에 "${pattern.name}" 패턴이 할당되었습니다`
        })
      }
    }
  }

  const applyToAllWeeks = () => {
    // 마지막으로 할당된 패턴 찾기
    const lastAssignedWeek = [...weekAssignments].reverse().find(w => w.patternId)

    if (!lastAssignedWeek) {
      toast({
        variant: 'destructive',
        title: '패턴 미선택',
        description: '먼저 패턴을 할당해주세요'
      })
      return
    }

    setWeekAssignments(prev =>
      prev.map(w =>
        w.isDeployed ? w : {
          ...w,
          patternId: lastAssignedWeek.patternId,
          patternName: lastAssignedWeek.patternName
        }
      )
    )

    toast({
      title: '일괄 적용 완료',
      description: `모든 주차에 "${lastAssignedWeek.patternName}" 패턴이 적용되었습니다`
    })
  }

  const clearWeek = (weekNumber: number) => {
    const targetWeek = weekAssignments.find(w => w.weekNumber === weekNumber)

    // 배포된 주차에 대한 경고
    if (targetWeek?.isDeployed) {
      toast({
        variant: 'default',
        title: '배포된 주차 수정',
        description: `${weekNumber}주차는 이미 배포되었습니다. 수정 후 재배포가 필요합니다.`
      })
    }

    setWeekAssignments(prev =>
      prev.map(w =>
        w.weekNumber === weekNumber
          ? { ...w, patternId: null, patternName: null }
          : w
      )
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">패턴 로딩 중...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 사용 가능한 패턴 목록 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              사용 가능한 패턴
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patterns.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <p>등록된 패턴이 없습니다</p>
                <p className="mt-2">먼저 주간 패턴을 생성해주세요</p>
              </div>
            ) : (
              <SortableContext items={patterns.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {patterns.map(pattern => (
                    <DraggablePattern key={pattern.id} pattern={pattern} />
                  ))}
                </div>
              </SortableContext>
            )}
          </CardContent>
        </Card>

        {/* 우측: 주차별 드롭 영역 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {year}년 {month}월 주차별 패턴
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={applyToAllWeeks}
                disabled={!weekAssignments.some(w => w.patternId)}
              >
                <Copy className="w-4 h-4 mr-2" />
                전체 주에 적용
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weekAssignments.map(week => (
                <WeekDropZone
                  key={week.weekNumber}
                  week={week}
                  onClear={() => clearWeek(week.weekNumber)}
                />
              ))}
            </div>

            {weekAssignments.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 팁: 좌측의 패턴을 드래그하여 주차 영역에 드롭하세요
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 드래그 오버레이 */}
      <DragOverlay>
        {activePattern ? (
          <div className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-lg">
            <div className="font-medium text-sm">{activePattern.name}</div>
            {activePattern.description && (
              <div className="text-xs text-gray-500 mt-1">{activePattern.description}</div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * 드래그 가능한 패턴 카드
 */
function DraggablePattern({ pattern }: { pattern: WeeklyPattern }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: pattern.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  // 월요일(1)부터 토요일(6)까지만 필터링 및 정렬
  const sortedPatterns = pattern.dailyPatterns
    ? [...pattern.dailyPatterns]
        .filter(dp => dp.dayOfWeek >= 1 && dp.dayOfWeek <= 6) // 월(1)~토(6)만
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    : []

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="bg-white border border-gray-200 rounded-lg p-3 cursor-move hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm">{pattern.name}</div>
              {pattern.description && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {pattern.description}
                </Badge>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-sm">
          <div className="space-y-2">
            <div className="font-semibold text-sm mb-2">{pattern.name}</div>
            {sortedPatterns.length > 0 ? (
              <div className="space-y-1 text-xs">
                {sortedPatterns.map((dp) => (
                  <div key={dp.dayOfWeek} className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 min-w-[32px] justify-center">
                      {dayNames[dp.dayOfWeek]}
                    </Badge>
                    {dp.combination && dp.combination.doctors && dp.combination.doctors.length > 0 ? (
                      <div className="flex-1">
                        <div className="text-gray-600">
                          {dp.combination.doctors.join(', ')}
                          {dp.combination.hasNightShift && (
                            <span className="text-blue-600 ml-1">• 야간</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">휴무</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">패턴 정보 없음</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * 주차 드롭 영역
 */
function WeekDropZone({
  week,
  onClear
}: {
  week: WeekAssignment
  onClear: () => void
}) {
  const {
    setNodeRef,
    isOver
  } = useSortable({ id: `week-${week.weekNumber}` })

  // 배포된 주차 스타일
  const isDeployed = week.isDeployed

  return (
    <div
      ref={setNodeRef}
      className={`border-2 rounded-lg p-4 transition-all ${
        isDeployed
          ? 'border-gray-400 bg-gray-100 cursor-not-allowed opacity-75'
          : isOver
          ? 'border-blue-500 bg-blue-50 border-dashed'
          : week.patternId
          ? 'border-green-300 bg-green-50 border-dashed'
          : 'border-gray-300 bg-gray-50 border-dashed'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge variant={isDeployed ? "secondary" : "outline"}>
              {week.weekNumber}주차
            </Badge>
            <span className="text-sm text-gray-600">{week.weekLabel}</span>
            {isDeployed && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Lock className="w-4 h-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{week.deployedFrom} 스케줄에서 배포됨</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {week.patternName ? (
            <div className="mt-2 flex items-center gap-2">
              <Badge className={isDeployed ? "bg-gray-600" : "bg-green-600"}>
                {week.patternName}
              </Badge>
              {isDeployed && (
                <span className="text-xs text-gray-500">
                  ({week.deployedFrom}에서 배포됨)
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 mt-2">
              {isDeployed ? '이미 배포된 주차입니다' : '패턴을 드래그하여 할당하세요'}
            </div>
          )}
        </div>
        {week.patternId && !isDeployed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * 월의 주 목록 생성 (일요일~토요일 기준)
 */
function getWeeksInMonth(monthStart: Date, monthEnd: Date) {
  const weeks: { start: Date; end: Date }[] = []

  // 해당 월의 첫날이 속한 주의 일요일 찾기
  let weekStart = new Date(monthStart)
  const firstDayOfWeek = monthStart.getDay() // 0=일요일

  // 일요일로 조정
  if (firstDayOfWeek !== 0) {
    weekStart.setDate(weekStart.getDate() - firstDayOfWeek)
  }

  // 해당 월의 마지막 날이 속한 주의 토요일 찾기
  let weekEnd = new Date(monthEnd)
  const lastDayOfWeek = monthEnd.getDay()

  // 토요일로 조정
  if (lastDayOfWeek !== 6) {
    weekEnd.setDate(weekEnd.getDate() + (6 - lastDayOfWeek))
  }

  // 주 단위로 생성 (일요일 ~ 토요일)
  let current = new Date(weekStart)

  while (current <= weekEnd) {
    const start = new Date(current)
    const end = new Date(current)
    end.setDate(end.getDate() + 6) // 일요일 + 6일 = 토요일

    // 마지막 주의 끝이 전체 종료일을 넘지 않도록
    if (end > weekEnd) {
      weeks.push({ start, end: new Date(weekEnd) })
      break
    } else {
      weeks.push({ start, end })
    }

    // 다음 주 (일요일)
    current.setDate(current.getDate() + 7)
  }

  return weeks
}

/**
 * 휴무일을 고려하여 주차 필터링
 * 마지막 주/첫 주에 해당 월의 근무일이 없으면 제외
 */
function getWeeksInMonthFiltered(
  monthStart: Date,
  monthEnd: Date,
  closedDays: any
) {
  const allWeeks = getWeeksInMonth(monthStart, monthEnd)

  if (!closedDays) {
    return allWeeks
  }

  // 날짜가 휴무일인지 확인
  const isClosedDay = (date: Date): boolean => {
    const dayOfWeek = date.getDay()

    // regularDays 확인 (숫자 배열: [0, 6] = 일요일, 토요일)
    if (closedDays.regularDays && Array.isArray(closedDays.regularDays)) {
      if (closedDays.regularDays.includes(dayOfWeek)) {
        return true
      }
    }

    // specificDates 확인
    if (closedDays.specificDates && Array.isArray(closedDays.specificDates)) {
      const dateStr = date.toISOString().split('T')[0]
      if (closedDays.specificDates.includes(dateStr)) return true
    }

    return false
  }

  // 주차 필터링
  return allWeeks.filter((week, index) => {
    const isFirstWeek = index === 0
    const isLastWeek = index === allWeeks.length - 1

    // 중간 주는 항상 포함
    if (!isFirstWeek && !isLastWeek) {
      return true
    }

    // 첫 주 또는 마지막 주: 해당 월의 날짜 중 근무일이 있는지 확인
    const targetMonth = monthStart.getMonth()
    let current = new Date(week.start)
    let hasWorkday = false

    while (current <= week.end) {
      // 해당 월에 속한 날짜만 확인
      if (current.getMonth() === targetMonth) {
        if (!isClosedDay(current)) {
          hasWorkday = true
          break
        }
      }
      current.setDate(current.getDate() + 1)
    }

    if (hasWorkday) {
      console.log(`[WeeklyPatternBuilder] Week ${index + 1} included: has workday in target month`)
    } else {
      console.log(`[WeeklyPatternBuilder] Week ${index + 1} excluded: no workday in target month`)
    }

    return hasWorkday
  })
}
