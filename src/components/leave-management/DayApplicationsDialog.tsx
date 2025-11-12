'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { Moon, RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

type LeaveApplication = {
  id: string
  leaveType: 'ANNUAL' | 'OFF'
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ON_HOLD' | 'REJECTED'
  staff: {
    id: string
    name: string
    rank: string
    email: string | null
    departmentName: string | null
    categoryName: string | null
  }
  link: {
    id: string
    year: number
    month: number
    token: string
    status: string
  }
  holdReason?: string | null
}

type DoctorSchedule = {
  doctorName: string
  doctorShortName: string
  hasNightShift: boolean
}

type StatusColumn = 'PENDING' | 'CONFIRMED' | 'ON_HOLD' | 'REJECTED'

const STATUS_INFO = {
  PENDING: {
    label: '신청 대기',
    color: 'bg-yellow-50 border-yellow-200',
    badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
  CONFIRMED: {
    label: '승인',
    color: 'bg-green-50 border-green-200',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  },
  ON_HOLD: {
    label: '보류',
    color: 'bg-orange-50 border-orange-200',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  REJECTED: {
    label: '반려',
    color: 'bg-red-50 border-red-200',
    badgeColor: 'bg-red-100 text-red-800 border-red-300',
  },
}

interface DayApplicationsDialogProps {
  open: boolean
  onClose: (updated: boolean) => void
  date: Date | null
  applications: LeaveApplication[]
  doctorSchedules: DoctorSchedule[]
}

export function DayApplicationsDialog({
  open,
  onClose,
  date,
  applications,
  doctorSchedules,
}: DayApplicationsDialogProps) {
  const { toast } = useToast()
  const [groupedApps, setGroupedApps] = useState<Record<StatusColumn, LeaveApplication[]>>({
    PENDING: [],
    CONFIRMED: [],
    ON_HOLD: [],
    REJECTED: [],
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  // 신청을 상태별로 그룹화
  useEffect(() => {
    if (open && applications) {
      const grouped: Record<StatusColumn, LeaveApplication[]> = {
        PENDING: [],
        CONFIRMED: [],
        ON_HOLD: [],
        REJECTED: [],
      }

      applications.forEach((app) => {
        // CANCELLED는 표시하지 않음
        if (app.status === 'CANCELLED') return

        const status = app.status as StatusColumn
        if (grouped[status]) {
          grouped[status].push(app)
        }
      })

      setGroupedApps(grouped)
    }
  }, [open, applications])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const applicationId = active.id as string
    const newStatus = over.id as StatusColumn

    // 현재 상태 찾기
    let currentStatus: StatusColumn | null = null
    let application: LeaveApplication | null = null

    for (const [status, apps] of Object.entries(groupedApps)) {
      const found = apps.find((app) => app.id === applicationId)
      if (found) {
        currentStatus = status as StatusColumn
        application = found
        break
      }
    }

    if (!currentStatus || !application || currentStatus === newStatus) {
      return
    }

    // 낙관적 업데이트
    const newGrouped = { ...groupedApps }
    newGrouped[currentStatus] = newGrouped[currentStatus].filter(
      (app) => app.id !== applicationId
    )
    newGrouped[newStatus] = [...newGrouped[newStatus], application]
    setGroupedApps(newGrouped)

    // 서버 업데이트
    try {
      setUpdating(true)

      const response = await fetch(`/api/leave-management/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '상태 변경 실패')
      }

      toast({
        title: '상태 변경 완료',
        description: `${application.staff.name}님의 신청이 ${STATUS_INFO[newStatus].label}(으)로 변경되었습니다.`,
      })
    } catch (error: any) {
      console.error('Status update error:', error)

      // 실패 시 롤백
      const rolledBack = { ...groupedApps }
      rolledBack[newStatus] = rolledBack[newStatus].filter((app) => app.id !== applicationId)
      rolledBack[currentStatus] = [...rolledBack[currentStatus], application]
      setGroupedApps(rolledBack)

      toast({
        variant: 'destructive',
        title: '상태 변경 실패',
        description: error.message || '다시 시도해주세요.',
      })
    } finally {
      setUpdating(false)
    }
  }

  const activeApplication = activeId
    ? Object.values(groupedApps)
        .flat()
        .find((app) => app.id === activeId)
    : null

  if (!date) return null

  const dateStr = formatDate(date)
  const hasNightShift = doctorSchedules.some((ds) => ds.hasNightShift)
  const doctorNames = doctorSchedules.map((ds) => ds.doctorName).join(', ')

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose(false)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>
                {date.getMonth() + 1}월 {date.getDate()}일
              </span>
              {doctorNames && (
                <>
                  <span className="text-gray-400">|</span>
                  <span className="text-sm font-normal text-gray-600">
                    원장: {doctorNames}
                  </span>
                  {hasNightShift && (
                    <Badge variant="outline" className="gap-1">
                      <Moon className="w-3 h-3" />
                      야간
                    </Badge>
                  )}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              드래그 앤 드롭으로 신청 상태를 변경할 수 있습니다
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-4 h-full">
              {(['PENDING', 'CONFIRMED', 'ON_HOLD', 'REJECTED'] as StatusColumn[]).map(
                (status) => (
                  <DropZone
                    key={status}
                    id={status}
                    label={STATUS_INFO[status].label}
                    color={STATUS_INFO[status].color}
                    applications={groupedApps[status]}
                  />
                )
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              총 {Object.values(groupedApps).flat().length}건
            </div>
            <Button variant="outline" onClick={() => onClose(true)}>
              닫기
            </Button>
          </div>

          {updating && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DragOverlay dropAnimation={null}>
        {activeApplication ? (
          <div style={{ cursor: 'grabbing', width: '280px' }}>
            <ApplicationCard application={activeApplication} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// 드롭 존 컴포넌트
function DropZone({
  id,
  label,
  color,
  applications,
}: {
  id: StatusColumn
  label: string
  color: string
  applications: LeaveApplication[]
}) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-3 ${color} min-h-[400px]`}
    >
      <div className="font-semibold text-sm mb-3 flex items-center justify-between">
        <span>{label}</span>
        <Badge variant="outline" className="text-xs">
          {applications.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {applications.map((app) => (
          <DraggableApplication key={app.id} application={app} />
        ))}
        {applications.length === 0 && (
          <div className="text-center text-gray-400 text-xs py-8">신청 없음</div>
        )}
      </div>
    </div>
  )
}

// 드래그 가능한 신청 카드
function DraggableApplication({ application }: { application: LeaveApplication }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-0' : ''}
    >
      <ApplicationCard application={application} />
    </div>
  )
}

// 신청 카드
function ApplicationCard({
  application,
  isDragging = false,
}: {
  application: LeaveApplication
  isDragging?: boolean
}) {
  return (
    <div
      className={`bg-white border rounded-lg p-3 ${isDragging ? 'cursor-grabbing shadow-2xl scale-105' : 'cursor-grab hover:shadow-md'} transition-shadow`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-medium">{application.staff.name}</div>
        <Badge
          variant="outline"
          className={`text-xs ${
            application.leaveType === 'ANNUAL'
              ? 'bg-blue-50 text-blue-700 border-blue-300'
              : 'bg-purple-50 text-purple-700 border-purple-300'
          }`}
        >
          {application.leaveType === 'ANNUAL' ? '연차' : '오프'}
        </Badge>
      </div>

      <div className="text-xs text-gray-600 space-y-1">
        {application.staff.departmentName && (
          <div>부서: {application.staff.departmentName}</div>
        )}
        {application.staff.categoryName && (
          <div>구분: {application.staff.categoryName}</div>
        )}
      </div>

      {application.holdReason && (
        <div className="mt-2 pt-2 border-t text-xs text-orange-600">
          보류 사유: {application.holdReason}
        </div>
      )}
    </div>
  )
}
