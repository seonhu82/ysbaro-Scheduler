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
    data: { staff, status },
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
          // 진료실 소속이면서 카테고리가 있는 활성 직원만 필터링
          setAvailableStaff(
            staffResult.data.filter((s: any) =>
              s.isActive &&
              s.departmentName === '진료실' &&
              s.categoryName
            ) || []
          )
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

  const handleSave = async (skipValidation = false) => {
    if (!schedule) return

    try {
      setLoading(true)

      // API로 직접 저장
      const response = await fetch('/api/schedule/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: schedule.date,
          doctors: schedule.doctors,
          staff: schedule.staff,
          annualLeave: schedule.annualLeave,
          offDays: schedule.offDays,
          isNightShift: schedule.isNightShift,
          year,
          month,
          skipValidation
        })
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
          // 경고 무시하고 저장
          setLoading(false)
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
  const handleDragEnd = (event: DragEndEvent) => {
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

    const activeData = active.data.current as { staff: StaffMember; status: string }
    const targetZone = over.id as string // 'working', 'annual', 'off'

    console.log('📌 이동 시도:', {
      staff: activeData?.staff?.name,
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

    const movedStaff = activeData.staff

    // 현재 위치에서 제거
    const newSchedule = { ...schedule }
    if (activeData.status === 'working') {
      newSchedule.staff = schedule.staff.filter(s => s.id !== movedStaff.id)
    } else if (activeData.status === 'annual') {
      newSchedule.annualLeave = (schedule.annualLeave || []).filter(s => s.id !== movedStaff.id)
    } else if (activeData.status === 'off') {
      newSchedule.offDays = (schedule.offDays || []).filter(s => s.id !== movedStaff.id)
    }

    // 새 위치에 추가
    if (targetZone === 'working') {
      newSchedule.staff = [...newSchedule.staff, movedStaff]
    } else if (targetZone === 'annual') {
      newSchedule.annualLeave = [...(newSchedule.annualLeave || []), movedStaff]
    } else if (targetZone === 'off') {
      newSchedule.offDays = [...(newSchedule.offDays || []), movedStaff]
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
                        {availableStaff
                          .filter(s => {
                            const isAlreadyAdded =
                              schedule?.staff.find(ss => ss.id === s.id) ||
                              schedule?.annualLeave?.find(ss => ss.id === s.id) ||
                              schedule?.offDays?.find(ss => ss.id === s.id)
                            return !isAlreadyAdded
                          })
                          .map(staff => (
                            <SelectItem key={staff.id} value={staff.id}>
                              {staff.name} ({staff.categoryName || staff.rank})
                            </SelectItem>
                          ))}
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
