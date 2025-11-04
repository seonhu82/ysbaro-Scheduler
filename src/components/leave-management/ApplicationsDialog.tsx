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
import { Card } from '@/components/ui/card'
import { Calendar, Users, Loader2 } from 'lucide-react'

interface ApplicationsDialogProps {
  open: boolean
  onClose: () => void
  period: {
    id: string
    year: number
    month: number
  } | null
}

interface Application {
  id: string
  date: string
  leaveType: 'ANNUAL' | 'OFF'
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  staff: {
    id: string
    name: string
    departmentName: string | null
    categoryName: string | null
  }
}

const STATUS_LABELS = {
  PENDING: '대기중',
  CONFIRMED: '확정',
  CANCELLED: '취소',
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

const LEAVE_TYPE_LABELS = {
  ANNUAL: '연차',
  OFF: '오프',
}

const LEAVE_TYPE_COLORS = {
  ANNUAL: 'bg-blue-100 text-blue-800',
  OFF: 'bg-purple-100 text-purple-800',
}

export function ApplicationsDialog({ open, onClose, period }: ApplicationsDialogProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (period && open) {
      fetchApplications()
    }
  }, [period, open])

  const fetchApplications = async () => {
    if (!period) return

    setLoading(true)
    try {
      const response = await fetch(`/api/leave-management/period/${period.id}/applications`)
      const result = await response.json()

      if (result.success) {
        setApplications(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!period) return null

  // 날짜별로 그룹화
  const applicationsByDate = applications.reduce((acc, app) => {
    const date = app.date
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(app)
    return acc
  }, {} as Record<string, Application[]>)

  const sortedDates = Object.keys(applicationsByDate).sort()

  // 통계 계산
  const stats = {
    total: applications.length,
    confirmed: applications.filter(a => a.status === 'CONFIRMED').length,
    pending: applications.filter(a => a.status === 'PENDING').length,
    annual: applications.filter(a => a.leaveType === 'ANNUAL').length,
    off: applications.filter(a => a.leaveType === 'OFF').length,
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {period.year}년 {period.month}월 신청 내역
          </DialogTitle>
          <DialogDescription>
            총 {stats.total}건의 신청이 있습니다
          </DialogDescription>
        </DialogHeader>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
            <div className="text-xs text-gray-600">전체</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            <div className="text-xs text-gray-600">확정</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-xs text-gray-600">대기</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.annual}</div>
            <div className="text-xs text-gray-600">연차</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.off}</div>
            <div className="text-xs text-gray-600">오프</div>
          </Card>
        </div>

        {/* 신청 내역 */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-600">신청 내역이 없습니다.</p>
            </div>
          ) : (
            sortedDates.map((date) => (
              <div key={date} className="border-l-4 border-blue-500 pl-4">
                <div className="font-semibold text-gray-700 mb-2">
                  {new Date(date).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                  <span className="text-sm text-gray-500 ml-2">
                    ({applicationsByDate[date].length}건)
                  </span>
                </div>
                <div className="space-y-2">
                  {applicationsByDate[date].map((app) => (
                    <Card key={app.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{app.staff.name}</span>
                            {app.staff.departmentName && (
                              <span className="text-xs text-gray-500">
                                {app.staff.departmentName}
                              </span>
                            )}
                            {app.staff.categoryName && (
                              <span className="text-xs text-gray-500">
                                · {app.staff.categoryName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={LEAVE_TYPE_COLORS[app.leaveType]}>
                            {LEAVE_TYPE_LABELS[app.leaveType]}
                          </Badge>
                          <Badge className={STATUS_COLORS[app.status]}>
                            {STATUS_LABELS[app.status]}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
