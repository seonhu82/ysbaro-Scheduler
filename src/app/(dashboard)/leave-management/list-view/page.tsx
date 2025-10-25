'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface LeaveApplication {
  id: string
  date: string
  leaveType: 'ANNUAL' | 'OFF'
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  staff: {
    name: string
    rank: string
  }
  submittedAt: string
  reviewedAt?: string
  reviewNote?: string
}

export default function ListViewPage() {
  const [applications, setApplications] = useState<LeaveApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    fetchApplications()
  }, [filter, dateFilter])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filter !== 'all') {
        params.append('status', filter)
      }

      if (dateFilter) {
        params.append('date', dateFilter)
      }

      const response = await fetch(`/api/leave-management/list-view?${params}`)
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

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/leave-management/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      })

      if (response.ok) {
        fetchApplications()
      }
    } catch (error) {
      console.error('Failed to approve:', error)
    }
  }

  const handleReject = async (id: string) => {
    const note = prompt('거절 사유를 입력하세요:')
    if (!note) return

    try {
      const response = await fetch(`/api/leave-management/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', reviewNote: note })
      })

      if (response.ok) {
        fetchApplications()
      }
    } catch (error) {
      console.error('Failed to reject:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      PENDING: { variant: 'secondary', label: '대기' },
      APPROVED: { variant: 'default', label: '승인' },
      REJECTED: { variant: 'destructive', label: '거절' }
    }
    const { variant, label } = variants[status] || { variant: 'secondary', label: status }
    return <Badge variant={variant}>{label}</Badge>
  }

  const getLeaveTypeBadge = (type: string) => {
    return type === 'ANNUAL' ? (
      <Badge variant="outline">연차</Badge>
    ) : (
      <Badge variant="outline">오프</Badge>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">연차 관리 - 목록뷰</h1>
        <p>로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">연차 관리 - 목록뷰</h1>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="all">전체</option>
            <option value="PENDING">대기</option>
            <option value="APPROVED">승인</option>
            <option value="REJECTED">거절</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>신청 목록 ({applications.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-gray-500 text-center py-8">신청 내역이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{app.staff.name}</span>
                        <span className="text-sm text-gray-500">({app.staff.rank})</span>
                        {getLeaveTypeBadge(app.leaveType)}
                        {getStatusBadge(app.status)}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">신청일:</span> {app.date}
                      </div>
                      {app.reason && (
                        <div className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">사유:</span> {app.reason}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        신청: {new Date(app.submittedAt).toLocaleString('ko-KR')}
                      </div>
                      {app.reviewedAt && (
                        <div className="text-xs text-gray-400">
                          처리: {new Date(app.reviewedAt).toLocaleString('ko-KR')}
                        </div>
                      )}
                      {app.reviewNote && (
                        <div className="text-sm text-red-600 mt-1">
                          거절 사유: {app.reviewNote}
                        </div>
                      )}
                    </div>
                    {app.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(app.id)}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(app.id)}
                        >
                          거절
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
