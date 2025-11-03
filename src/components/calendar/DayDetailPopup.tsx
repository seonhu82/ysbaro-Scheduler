'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateWithDay, isSunday, isWeekend } from '@/lib/date-utils'
import { Calendar, Users, UserPlus, Edit, Save, X, GripVertical } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface Doctor {
  id: string
  name: string
}

interface StaffMember {
  id: string
  name: string
  rank: string
  categoryName?: string
  departmentName?: string
  isFlexible?: boolean
  originalCategory?: string
  assignedCategory?: string
}

interface DaySchedule {
  id?: string
  date: string
  doctors: Doctor[]
  staff: StaffMember[]
  annualLeave?: StaffMember[]
  offDays?: StaffMember[]
  isNightShift: boolean
}

interface DayDetailPopupProps {
  date: Date | null
  isOpen: boolean
  onClose: () => void
  onSave?: (schedule: DaySchedule) => Promise<void>
  year?: number
  month?: number
  status?: 'DRAFT' | 'DEPLOYED'
}

// 드래그 가능한 직원 카드 컴포넌트
function DraggableStaffCard({
  staff,
  status,
  isEditing,
  onRemove
}: {
  staff: StaffMember
  status: 'working' | 'annual' | 'off'
  isEditing: boolean
  onRemove?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: staff.id,
    data: {
      staffId: staff.id,
      staffName: staff.name,
      status
    },
    disabled: !isEditing
  })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  const getBgColor = () => {
    switch (status) {
      case 'annual': return 'bg-blue-50 border-blue-200'
      case 'off': return 'bg-green-50 border-green-200'
      default: return 'bg-gray-50'
    }
  }

  const getBadgeColor = () => {
    switch (status) {
      case 'annual': return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'off': return 'bg-green-100 text-green-700 border-green-300'
      default: return ''
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'annual': return '연차'
      case 'off': return '오프'
      default: return staff.categoryName || staff.rank
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2 rounded border ${getBgColor()} ${
        isEditing ? 'cursor-move' : ''
      }`}
    >
      <div className="flex items-center gap-2 flex-1">
        {isEditing && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="font-medium">{staff.name}</span>
          <Badge variant="outline" className={`${getBadgeColor()}`}>
            {getStatusText()}
          </Badge>
          {staff.isFlexible && status === 'working' && (
            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
              🅱️ 유연
            </Badge>
          )}
        </div>
      </div>
      {isEditing && onRemove && (
        <X
          className="w-4 h-4 cursor-pointer hover:text-red-500"
          onClick={onRemove}
        />
      )}
    </div>
  )
}

// 드롭 존 컴포넌트
function DroppableZone({
  id,
  title,
  count,
  children,
}: {
  id: string
  title: string
  count: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-4 transition-colors min-h-[200px] ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4" />
          {title} ({count}명)
        </h3>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {children}
      </div>
    </div>
  )
}

export function DayDetailPopup({
  date,
  isOpen,
  onClose,
  onSave,
  year,
  month,
  status,
}: DayDetailPopupProps) {
  const { toast } = useToast()
  const [schedule, setSchedule] = useState<DaySchedule | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([])
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<string>('')
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이동 후 드래그 시작
      },
    }),
    useSensor(KeyboardSensor)
  )

  // 스케줄 데이터 로딩
  useEffect(() => {
    console.log('🔍 DayDetailPopup useEffect triggered:', { date, isOpen, year, month, status })
    if (!date || !isOpen) {
      console.log('❌ Early return - no date or not open')
      return
    }

    const fetchDaySchedule = async () => {
      setLoading(true)
      try {
        // 시간대 문제 해결: 로컬 날짜를 YYYY-MM-DD 형식으로 변환
        const localYear = date.getFullYear()
        const localMonth = String(date.getMonth() + 1).padStart(2, '0')
        const localDay = String(date.getDate()).padStart(2, '0')
        const dateStr = `${localYear}-${localMonth}-${localDay}`

        // API URL 구성
        let apiUrl = `/api/schedule/day?date=${dateStr}`
        if (year && month) {
          apiUrl += `&year=${year}&month=${month}`
        }
        if (status) {
          apiUrl += `&status=${status}`
        }

        const [scheduleRes, doctorsRes, staffRes] = await Promise.all([
          fetch(apiUrl),
          fetch('/api/doctors'),
          fetch('/api/staff')
        ])

        const [scheduleResult, doctorsResult, staffResult] = await Promise.all([
          scheduleRes.json(),
          doctorsRes.json(),
          staffRes.json()
        ])

        console.log('Schedule result:', scheduleResult)
        console.log('Full data object:', JSON.stringify(scheduleResult.data, null, 2))

        if (scheduleResult.success && scheduleResult.data) {
          console.log('Annual leave:', scheduleResult.data.annualLeave)
          console.log('Off days:', scheduleResult.data.offDays)

          // 부서 → 카테고리 → 이름 순으로 정렬하는 함수
          const sortByDepartmentAndCategory = (staffList: StaffMember[]) => {
            const departmentOrder: { [key: string]: number } = {
              '원장': 0,
              '진료실': 1,
              '데스크': 2
            }

            const categoryOrder: { [key: string]: number } = {
              '팀장/실장': 0,
              '고년차': 1,
              '중간년차': 2,
              '저년차': 3
            }

            const sorted = [...staffList].sort((a, b) => {
              // 1. 부서별 정렬 (원장 → 진료실 → 데스크)
              const deptA = departmentOrder[a.departmentName || ''] ?? 999
              const deptB = departmentOrder[b.departmentName || ''] ?? 999
              if (deptA !== deptB) return deptA - deptB

              // 2. 카테고리별 정렬 (팀장 → 고년차 → 중년차 → 저년차)
              const orderA = categoryOrder[a.categoryName || ''] ?? 999
              const orderB = categoryOrder[b.categoryName || ''] ?? 999
              if (orderA !== orderB) return orderA - orderB

              // 3. 이름 정렬
              return a.name.localeCompare(b.name)
            })

            console.log('🔤 Department + Category sorting:', {
              before: staffList.map(s => `${s.name}(${s.departmentName}/${s.categoryName})`),
              after: sorted.map(s => `${s.name}(${s.departmentName}/${s.categoryName})`)
            })

            return sorted
          }

          const sortedStaff = sortByDepartmentAndCategory(scheduleResult.data.staff || [])
          const sortedAnnualLeave = sortByDepartmentAndCategory(scheduleResult.data.annualLeave || [])
          const sortedOffDays = sortByDepartmentAndCategory(scheduleResult.data.offDays || [])

          console.log('✅ Final sorted staff:', sortedStaff.map(s => `${s.name}(${s.categoryName})`))

          setSchedule({
            id: scheduleResult.data.id,
            date: scheduleResult.data.date,
            doctors: scheduleResult.data.doctors || [],
            staff: sortedStaff,
            annualLeave: sortedAnnualLeave,
            offDays: sortedOffDays,
            isNightShift: scheduleResult.data.isNightShift || false,
          })
        } else {
          // 데이터가 없으면 빈 스케줄
          setSchedule({
            date: dateStr,
            doctors: [],
            staff: [],
            annualLeave: [],
            offDays: [],
            isNightShift: false,
          })
        }

        // 사용 가능한 원장과 직원 목록 저장
        if (doctorsResult.success) {
          setAvailableDoctors(doctorsResult.data || [])
        }
        if (staffResult.success) {
          // 진료실 소속 활성 직원만 필터링
          const filteredStaff = staffResult.data.filter((s: any) =>
            s.isActive && s.departmentName === '진료실'
          ) || []

          console.log('📋 Available staff filter:', {
            total: staffResult.data.length,
            active: staffResult.data.filter((s: any) => s.isActive).length,
            treatment: staffResult.data.filter((s: any) => s.departmentName === '진료실').length,
            filtered: filteredStaff.length,
            filteredNames: filteredStaff.map((s: any) => `${s.name}(${s.categoryName || '미분류'})`)
          })

          setAvailableStaff(filteredStaff)
        }
      } catch (error) {
        console.error('Failed to fetch day schedule:', error)
        // 에러 시에도 빈 스케줄 표시
        setSchedule({
          date: date.toISOString().split('T')[0],
          doctors: [],
          staff: [],
          annualLeave: [],
          offDays: [],
          isNightShift: false,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDaySchedule()
  }, [date, isOpen, year, month, status])

  const handleSave = async (skipValidation: boolean | any = false) => {
    if (!schedule) return

    // skipValidation이 이벤트 객체인 경우 false로 처리
    const shouldSkipValidation = typeof skipValidation === 'boolean' ? skipValidation : false

    try {
      setLoading(true)

      // API로 직접 저장 (필요한 필드만 추출)
      // Circular reference 완전 제거: 배열을 JSON으로 직렬화한 후 역직렬화
      const cleanDoctors: any[] = []
      for (const d of (schedule.doctors || [])) {
        cleanDoctors.push({ id: String(d.id), name: String(d.name) })
      }

      const cleanStaff: any[] = []
      for (const s of (schedule.staff || [])) {
        cleanStaff.push({
          id: String(s.id),
          name: String(s.name),
          rank: String(s.rank || ''),
          categoryName: s.categoryName ? String(s.categoryName) : undefined,
          departmentName: s.departmentName ? String(s.departmentName) : undefined
        })
      }

      const cleanAnnualLeave: any[] = []
      for (const s of (schedule.annualLeave || [])) {
        cleanAnnualLeave.push({
          id: String(s.id),
          name: String(s.name),
          rank: String(s.rank || ''),
          categoryName: s.categoryName ? String(s.categoryName) : undefined,
          departmentName: s.departmentName ? String(s.departmentName) : undefined
        })
      }

      const cleanOffDays: any[] = []
      for (const s of (schedule.offDays || [])) {
        cleanOffDays.push({
          id: String(s.id),
          name: String(s.name),
          rank: String(s.rank || ''),
          categoryName: s.categoryName ? String(s.categoryName) : undefined,
          departmentName: s.departmentName ? String(s.departmentName) : undefined
        })
      }

      const cleanPayload = {
        date: String(schedule.date),
        doctors: cleanDoctors,
        staff: cleanStaff,
        annualLeave: cleanAnnualLeave,
        offDays: cleanOffDays,
        isNightShift: Boolean(schedule.isNightShift),
        year: year,
        month: month,
        skipValidation: shouldSkipValidation
      }

      console.log('📤 Attempting to send payload...')

      // 각 필드를 개별적으로 직렬화 테스트
      try {
        console.log('Testing date:', JSON.stringify(cleanPayload.date))
      } catch (e) {
        console.error('❌ Date has circular ref')
      }

      try {
        console.log('Testing doctors:', JSON.stringify(cleanPayload.doctors))
      } catch (e) {
        console.error('❌ Doctors has circular ref:', cleanPayload.doctors)
      }

      try {
        console.log('Testing staff:', JSON.stringify(cleanPayload.staff))
      } catch (e) {
        console.error('❌ Staff has circular ref:', cleanPayload.staff)
      }

      try {
        console.log('Testing annualLeave:', JSON.stringify(cleanPayload.annualLeave))
      } catch (e) {
        console.error('❌ AnnualLeave has circular ref:', cleanPayload.annualLeave)
      }

      try {
        console.log('Testing offDays:', JSON.stringify(cleanPayload.offDays))
      } catch (e) {
        console.error('❌ OffDays has circular ref:', cleanPayload.offDays)
      }

      const response = await fetch('/api/schedule/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanPayload)
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to save schedule')
      }

      // 경고가 있으면 사용자에게 확인
      if (result.data?.requireConfirmation && result.data?.warnings) {
        const warningMessage = result.data.warnings.join('\n')
        const confirmed = window.confirm(
          `${result.data.message}\n\n${warningMessage}\n\n계속하시겠습니까?`
        )

        if (confirmed) {
          // 경고 무시하고 저장 (loading 상태 유지)
          await handleSave(true) // skipValidation = true로 재시도
          return
        } else {
          setLoading(false)
          return
        }
      }

      console.log('Schedule saved successfully:', result)
      setIsEditing(false)

      // 데이터 새로고침
      const refreshResponse = await fetch(
        `/api/schedule/day?date=${schedule.date}${year ? `&year=${year}` : ''}${month ? `&month=${month}` : ''}${status ? `&status=${status}` : ''}`
      )
      const refreshResult = await refreshResponse.json()

      if (refreshResult.success && refreshResult.data) {
        // 카테고리별로 정렬
        const sortByCategory = (staffList: StaffMember[]) => {
          const categoryOrder: { [key: string]: number } = {
            '팀장': 0,
            '실팀장': 0,
            '고년차': 1,
            '중년차': 2,
            '저년차': 3
          }
          const sorted = [...staffList].sort((a, b) => {
            const orderA = categoryOrder[a.categoryName || ''] ?? 999
            const orderB = categoryOrder[b.categoryName || ''] ?? 999
            if (orderA !== orderB) return orderA - orderB
            return a.name.localeCompare(b.name)
          })

          console.log('🔤 Category sorting (after save):', {
            before: staffList.map(s => `${s.name}(${s.categoryName})`),
            after: sorted.map(s => `${s.name}(${s.categoryName})`)
          })

          return sorted
        }

        const sortedStaff = sortByCategory(refreshResult.data.staff || [])
        const sortedAnnualLeave = sortByCategory(refreshResult.data.annualLeave || [])
        const sortedOffDays = sortByCategory(refreshResult.data.offDays || [])

        setSchedule({
          id: refreshResult.data.id,
          date: refreshResult.data.date,
          doctors: refreshResult.data.doctors || [],
          staff: sortedStaff,
          annualLeave: sortedAnnualLeave,
          offDays: sortedOffDays,
          isNightShift: refreshResult.data.isNightShift || false,
        })
      }

      // 상위 컴포넌트의 onSave 콜백도 호출 (있으면)
      if (onSave) {
        await onSave(schedule)
      }

      // 저장 성공 메시지
      toast({
        title: '저장 완료',
        description: '스케줄이 성공적으로 저장되었습니다'
      })

      // 팝업 닫기
      onClose()
    } catch (error) {
      console.error('Failed to save schedule:', error)
      alert('저장에 실패했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'))
    } finally {
      setLoading(false)
    }
  }

  // 드래그 시작
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  // 드래그 중 (드롭 존 위에 있을 때)
  const handleDragOver = (event: any) => {
    const { over } = event
    setOverId(over?.id || null)
  }

  // 드래그 종료
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    console.log('🎯 드래그 종료:', {
      activeId: active.id,
      overId: over?.id,
      activeData: active.data.current
    })

    setActiveId(null)
    setOverId(null)

    // 드롭 존이 없거나 스케줄이 없으면 원래 위치로 돌아감 (아무 작업 안 함)
    if (!over || !schedule) {
      console.log('❌ 드래그 취소: 유효한 드롭 존이 없음 - 원래 위치 유지')
      return
    }

    const activeData = active.data.current as { staffId: string; staffName: string; status: string }
    const targetZone = over.id as string // 'working', 'annual', 'off'

    console.log('📌 이동 시도:', {
      staffId: activeData?.staffId,
      staffName: activeData?.staffName,
      from: activeData?.status,
      to: targetZone
    })

    // 유효한 드롭 존인지 확인 ('working', 'annual', 'off' 중 하나여야 함)
    if (!['working', 'annual', 'off'].includes(targetZone)) {
      console.log('❌ 드래그 취소: 유효하지 않은 드롭 존 - 원래 위치 유지')
      return
    }

    // 같은 위치로 이동하면 아무 작업 안 함
    if (!activeData || activeData.status === targetZone) {
      console.log('ℹ️  드래그 취소: 같은 위치')
      return
    }

    const staffId = activeData.staffId

    // 이동할 직원 찾기
    let movedStaff: StaffMember | undefined
    if (activeData.status === 'working') {
      movedStaff = schedule.staff.find(s => s.id === staffId)
    } else if (activeData.status === 'annual') {
      movedStaff = schedule.annualLeave?.find(s => s.id === staffId)
    } else if (activeData.status === 'off') {
      movedStaff = schedule.offDays?.find(s => s.id === staffId)
    }

    if (!movedStaff) {
      console.log('❌ 이동할 직원을 찾을 수 없습니다')
      return
    }

    // 현재 위치에서 제거
    const newSchedule = { ...schedule }
    if (activeData.status === 'working') {
      newSchedule.staff = schedule.staff.filter(s => s.id !== staffId)
    } else if (activeData.status === 'annual') {
      newSchedule.annualLeave = (schedule.annualLeave || []).filter(s => s.id !== staffId)
    } else if (activeData.status === 'off') {
      newSchedule.offDays = (schedule.offDays || []).filter(s => s.id !== staffId)
    }

    // 새 위치에 추가
    if (targetZone === 'working') {
      newSchedule.staff = [...newSchedule.staff, movedStaff]
    } else if (targetZone === 'annual') {
      newSchedule.annualLeave = [...(newSchedule.annualLeave || []), movedStaff]
    } else if (targetZone === 'off') {
      newSchedule.offDays = [...(newSchedule.offDays || []), movedStaff]
    }

    // ========== 드래그 검증 로직 ==========
    const warnings: string[] = []

    console.log('🔍 드래그 검증 시작:', {
      staffName: movedStaff.name,
      from: activeData.status,
      to: targetZone,
      year,
      month,
      date: schedule.date,
      isNightShift: schedule.isNightShift
    })

    // 1. 팀장/실장이 근무에서 빠지면 경고
    if (activeData.status === 'working' && targetZone !== 'working') {
      const isLeader = movedStaff.categoryName === '팀장/실장' || movedStaff.categoryName === '팀장' || movedStaff.categoryName === '실장'

      if (isLeader) {
        const remainingLeaders = newSchedule.staff.filter(s =>
          s.categoryName === '팀장/실장' || s.categoryName === '팀장' || s.categoryName === '실장'
        )

        if (remainingLeaders.length === 0) {
          warnings.push(`⚠️ ${movedStaff.name}은(는) 팀장/실장입니다.\n이동하면 근무 중인 팀장/실장이 0명이 됩니다.`)
        }
      }
    }

    // 2. 월 형평성 체크 (이동 후 상태 기준) - 편차 ±1 기준
    if (targetZone === 'working') {
      console.log('✅ 월 형평성 체크 실행')
      // working으로 이동하는 경우 형평성 체크
      try {
        // year/month가 없으면 schedule.date에서 추출
        const scheduleDate = new Date(schedule.date)
        const checkYear = year || scheduleDate.getFullYear()
        const checkMonth = month || (scheduleDate.getMonth() + 1)

        const isNightShift = schedule.isNightShift
        const includeHoliday = true // 설정에서 가져와야 함

        console.log('📅 형평성 체크 파라미터:', { checkYear, checkMonth, isNightShift })

        const response = await fetch(
          `/api/staff/work-days?staffId=${movedStaff.id}&year=${checkYear}&month=${checkMonth}&includeHoliday=${includeHoliday}`
        )
        const result = await response.json()

        console.log('📊 형평성 API 응답:', result)

        if (result.success) {
          const { current, average, deviation } = result.data

          const warningMessages: string[] = []

          // 이동 후 각 타입별 편차 계산
          if (isNightShift) {
            // 야근으로 이동
            const afterNightDeviation = deviation.night + 1
            console.log('🌙 야근 편차:', { current: current.night, avg: average.night, after: afterNightDeviation })
            if (Math.abs(afterNightDeviation) > 1) {
              warningMessages.push(`야근: ${(current.night + 1)}일 (평균: ${average.night.toFixed(1)}일, 편차: ${afterNightDeviation > 0 ? '+' : ''}${afterNightDeviation.toFixed(1)})`)
            }
          } else {
            // 일반 근무로 이동 - 현재 날짜가 주말/공휴일인지 체크
            const currentDate = new Date(schedule.date)
            const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6
            const isHoliday = currentDate.getDay() === 0 // 임시: 일요일만 공휴일로 간주

            console.log('📆 날짜 타입:', { isWeekend, isHoliday, day: currentDate.getDay() })

            if (isHoliday && includeHoliday) {
              const afterHolidayDeviation = deviation.holiday + 1
              console.log('🎉 공휴일 편차:', { current: current.holiday, avg: average.holiday, after: afterHolidayDeviation })
              if (Math.abs(afterHolidayDeviation) > 1) {
                warningMessages.push(`공휴일: ${(current.holiday + 1)}일 (평균: ${average.holiday.toFixed(1)}일, 편차: ${afterHolidayDeviation > 0 ? '+' : ''}${afterHolidayDeviation.toFixed(1)})`)
              }
            } else if (isWeekend) {
              const afterWeekendDeviation = deviation.weekend + 1
              console.log('🏖️ 주말 편차:', { current: current.weekend, avg: average.weekend, after: afterWeekendDeviation })
              if (Math.abs(afterWeekendDeviation) > 1) {
                warningMessages.push(`주말: ${(current.weekend + 1)}일 (평균: ${average.weekend.toFixed(1)}일, 편차: ${afterWeekendDeviation > 0 ? '+' : ''}${afterWeekendDeviation.toFixed(1)})`)
              }
            } else {
              const afterRegularDeviation = deviation.regular + 1
              console.log('📋 일반 편차:', { current: current.regular, avg: average.regular, after: afterRegularDeviation })
              if (Math.abs(afterRegularDeviation) > 1) {
                warningMessages.push(`일반: ${(current.regular + 1)}일 (평균: ${average.regular.toFixed(1)}일, 편차: ${afterRegularDeviation > 0 ? '+' : ''}${afterRegularDeviation.toFixed(1)})`)
              }
            }
          }

          // 전체 근무일 수 편차 체크
          const afterTotalDeviation = deviation.total + 1
          console.log('📊 전체 편차:', { current: current.total, avg: average.total, after: afterTotalDeviation })
          if (Math.abs(afterTotalDeviation) > 1) {
            warningMessages.push(`전체: ${(current.total + 1)}일 (평균: ${average.total.toFixed(1)}일, 편차: ${afterTotalDeviation > 0 ? '+' : ''}${afterTotalDeviation.toFixed(1)})`)
          }

          if (warningMessages.length > 0) {
            warnings.push(`⚠️ ${movedStaff.name}: 이번 달 근무 편차 초과\n${warningMessages.join('\n')}`)
          } else {
            console.log('✅ 형평성 체크 통과 (편차 ±1 이내)')
          }
        }
      } catch (error) {
        console.error('❌ 월 근무일 수 체크 실패:', error)
      }
    } else {
      console.log('⏭️ 월 형평성 체크 스킵 (working으로 이동 아님)')
    }

    // 3. 주4일 근무제 체크 (working으로 이동 시)
    if (targetZone === 'working') {
      console.log('✅ 주4일 근무제 체크 실행')
      try {
        const response = await fetch(
          `/api/staff/weekly-work-days?staffId=${movedStaff.id}&date=${schedule.date}`
        )
        const result = await response.json()

        console.log('📅 주4일 API 응답:', result)

        if (result.success) {
          let weeklyWorkDays = result.data.weeklyWorkDays || 0

          // 현재 이 직원이 이미 해당 날짜에 working으로 배정되어 있는지 확인
          const isAlreadyWorking = activeData.status === 'working'

          console.log('📋 현재 상태:', {
            from: activeData.status,
            to: targetZone,
            isAlreadyWorking,
            weeklyWorkDays
          })

          // 이동 후 주간 근무일 수 계산
          // - 이미 working이었으면: 그대로 (같은 주에서 이동)
          // - off/annual에서 오면: +1
          const afterWeeklyWorkDays = isAlreadyWorking ? weeklyWorkDays : weeklyWorkDays + 1

          console.log('📊 주간 근무일:', {
            current: weeklyWorkDays,
            after: afterWeeklyWorkDays,
            limit: 4,
            willAdd: !isAlreadyWorking
          })

          if (afterWeeklyWorkDays > 4) {
            warnings.push(`⚠️ ${movedStaff.name}: 주4일 근무 초과 예상\n(이동 후: ${afterWeeklyWorkDays}일 근무, 주간 허용: 4일)`)
            console.log('⚠️ 주4일 경고 발생!')
          } else {
            console.log('✅ 주4일 체크 통과')
          }
        }
      } catch (error) {
        console.error('❌ 주간 근무일 수 체크 실패:', error)
      }
    } else {
      console.log('⏭️ 주4일 체크 스킵 (working으로 이동 아님)')
    }

    // 4. 필수 인원 체크 (working 관련 이동 시 항상 체크)
    if (activeData.status === 'working' || targetZone === 'working') {
      console.log('✅ 필수 인원 체크 실행 (이동 후 상태 기준)')
      try {
        const response = await fetch(
          `/api/schedule/validate-staff-count`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              doctors: schedule.doctors,
              staff: newSchedule.staff, // 이동 후 staff 배열
              date: schedule.date
            })
          }
        )
        const result = await response.json()

        console.log('👥 필수 인원 API 응답:', result)
        console.log('👥 전송한 데이터:', {
          doctors: schedule.doctors?.length,
          staff: newSchedule.staff?.length,
          staffNames: newSchedule.staff?.map((s: any) => `${s.name}(${s.categoryName})`)
        })

        if (result.success && result.data.warnings && result.data.warnings.length > 0) {
          warnings.push(...result.data.warnings)
          console.log('⚠️ 필수 인원 경고:', result.data.warnings)
        } else {
          console.log('✅ 필수 인원 체크 통과')
        }
      } catch (error) {
        console.error('❌ 필수 인원 체크 실패:', error)
      }
    } else {
      console.log('⏭️ 필수 인원 체크 스킵 (working 관련 이동 아님)')
    }

    // 경고가 있으면 사용자 확인
    console.log(`🔔 총 경고 수: ${warnings.length}`)
    if (warnings.length > 0) {
      console.log('⚠️ 경고 내용:', warnings)
      const confirmed = window.confirm(
        `⚠️ 경고\n\n${warnings.join('\n\n')}\n\n그래도 이동하시겠습니까?`
      )

      if (!confirmed) {
        console.log('❌ 사용자가 이동 취소 (검증 경고)')
        return
      }
      console.log('✅ 사용자가 경고 무시하고 진행')
    } else {
      console.log('✅ 모든 검증 통과 (경고 없음)')
    }

    setSchedule(newSchedule)
    console.log(`✅ 직원 이동 완료: ${movedStaff.name} (${activeData.status} → ${targetZone})`)
  }

  if (!date) return null

  const sunday = isSunday(date)
  const weekend = isWeekend(date)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {formatDateWithDay(date)}
            {sunday && (
              <Badge variant="destructive" className="ml-2">
                휴무
              </Badge>
            )}
            {weekend && !sunday && (
              <Badge variant="secondary" className="ml-2">
                주말
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            날짜별 스케줄을 확인하고 관리합니다
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 원장 목록 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  근무 원장
                </h3>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <Select
                    value={selectedDoctor}
                    onValueChange={(value) => {
                      setSelectedDoctor(value)
                      if (value && schedule) {
                        const doctor = availableDoctors.find(d => d.id === value)
                        if (doctor && !schedule.doctors.find(d => d.id === doctor.id)) {
                          setSchedule({
                            ...schedule,
                            doctors: [...schedule.doctors, doctor]
                          })
                        }
                      }
                      setSelectedDoctor('')
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="원장 추가하기" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDoctors
                        .filter(d => !schedule?.doctors.find(sd => sd.id === d.id))
                        .map(doctor => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {schedule?.doctors && schedule.doctors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {schedule.doctors.map((doctor) => (
                        <Badge key={doctor.id} variant="default" className="flex items-center gap-1">
                          {doctor.name}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-red-500"
                            onClick={() => {
                              setSchedule({
                                ...schedule,
                                doctors: schedule.doctors.filter(d => d.id !== doctor.id)
                              })
                            }}
                          />
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">원장이 배정되지 않았습니다</p>
                  )}
                </div>
              ) : (
                <>
                  {schedule?.doctors && schedule.doctors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {schedule.doctors.map((doctor) => (
                        <Badge key={doctor.id} variant="default">
                          {doctor.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">원장이 배정되지 않았습니다</p>
                  )}
                </>
              )}
            </div>

            {/* 직원 상태 관리 (드래그 앤 드롭) */}
            {isEditing ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="space-y-4">
                  {/* 직원 추가 */}
                  <div>
                    <Select
                      value={selectedStaff}
                      onValueChange={(value) => {
                        setSelectedStaff(value)
                        if (value && schedule) {
                          const staff = availableStaff.find(s => s.id === value)
                          const isAlreadyAdded =
                            schedule.staff.find(s => s.id === staff?.id) ||
                            schedule.annualLeave?.find(s => s.id === staff?.id) ||
                            schedule.offDays?.find(s => s.id === staff?.id)

                          if (staff && !isAlreadyAdded) {
                            setSchedule({
                              ...schedule,
                              staff: [...schedule.staff, staff]
                            })
                          }
                        }
                        setSelectedStaff('')
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="직원 추가하기 (추가 후 드래그로 이동 가능)" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const allStaffIds = new Set([
                            ...(schedule?.staff || []).map(s => s.id),
                            ...(schedule?.annualLeave || []).map(s => s.id),
                            ...(schedule?.offDays || []).map(s => s.id)
                          ])

                          const filtered = availableStaff.filter(s => !allStaffIds.has(s.id))

                          console.log('🔍 필터링 상태:', {
                            전체: availableStaff.length,
                            근무: schedule?.staff?.length || 0,
                            연차: schedule?.annualLeave?.length || 0,
                            오프: schedule?.offDays?.length || 0,
                            선택가능: filtered.length
                          })

                          return filtered.map(staff => (
                            <SelectItem key={staff.id} value={staff.id}>
                              {staff.name} ({staff.categoryName || staff.rank})
                            </SelectItem>
                          ))
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 드래그 앤 드롭 영역 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 근무 직원 드롭존 */}
                    <DroppableZone
                      id="working"
                      title="근무 직원"
                      count={schedule?.staff?.length || 0}
                    >
                      {schedule?.staff && schedule.staff.length > 0 ? (
                        schedule.staff.map((staff) => (
                          <DraggableStaffCard
                            key={staff.id}
                            staff={staff}
                            status="working"
                            isEditing={true}
                            onRemove={() => {
                              setSchedule({
                                ...schedule,
                                staff: schedule.staff.filter(s => s.id !== staff.id)
                              })
                            }}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                          직원을 여기로 드래그하세요
                        </p>
                      )}
                    </DroppableZone>

                    {/* 연차 드롭존 */}
                    <DroppableZone
                      id="annual"
                      title="연차"
                      count={schedule?.annualLeave?.length || 0}
                    >
                      {schedule?.annualLeave && schedule.annualLeave.length > 0 ? (
                        schedule.annualLeave.map((staff) => (
                          <DraggableStaffCard
                            key={staff.id}
                            staff={staff}
                            status="annual"
                            isEditing={true}
                            onRemove={() => {
                              setSchedule({
                                ...schedule,
                                annualLeave: schedule.annualLeave?.filter(s => s.id !== staff.id)
                              })
                            }}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                          직원을 여기로 드래그하세요
                        </p>
                      )}
                    </DroppableZone>

                    {/* 오프 드롭존 */}
                    <DroppableZone
                      id="off"
                      title="오프"
                      count={schedule?.offDays?.length || 0}
                    >
                      {schedule?.offDays && schedule.offDays.length > 0 ? (
                        schedule.offDays.map((staff) => (
                          <DraggableStaffCard
                            key={staff.id}
                            staff={staff}
                            status="off"
                            isEditing={true}
                            onRemove={() => {
                              setSchedule({
                                ...schedule,
                                offDays: schedule.offDays?.filter(s => s.id !== staff.id)
                              })
                            }}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                          직원을 여기로 드래그하세요
                        </p>
                      )}
                    </DroppableZone>
                  </div>
                </div>
              </DndContext>
            ) : (
              /* 읽기 전용 뷰 */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 근무 직원 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      근무 직원 ({schedule?.staff?.length || 0}명)
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {schedule?.staff && schedule.staff.length > 0 ? (
                      schedule.staff.map((staff) => (
                        <DraggableStaffCard
                          key={staff.id}
                          staff={staff}
                          status="working"
                          isEditing={false}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">배치된 직원이 없습니다</p>
                    )}
                  </div>
                </div>

                {/* 연차 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      연차 ({schedule?.annualLeave?.length || 0}명)
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {schedule?.annualLeave && schedule.annualLeave.length > 0 ? (
                      schedule.annualLeave.map((staff) => (
                        <DraggableStaffCard
                          key={staff.id}
                          staff={staff}
                          status="annual"
                          isEditing={false}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">연차 직원이 없습니다</p>
                    )}
                  </div>
                </div>

                {/* 오프 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      오프 ({schedule?.offDays?.length || 0}명)
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {schedule?.offDays && schedule.offDays.length > 0 ? (
                      schedule.offDays.map((staff) => (
                        <DraggableStaffCard
                          key={staff.id}
                          staff={staff}
                          status="off"
                          isEditing={false}
                        />
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">오프 직원이 없습니다</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              {!isEditing ? (
                <>
                  <Button variant="outline" onClick={onClose}>
                    닫기
                  </Button>
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    편집
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={loading}
                  >
                    취소
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="w-4 h-4 mr-1" />
                    {loading ? '저장 중...' : '저장'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
