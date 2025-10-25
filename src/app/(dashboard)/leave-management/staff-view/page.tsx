'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface StaffLeaveData {
  staffId: string
  staffName: string
  staffRank: string
  totalApplications: number
  pending: number
  approved: number
  rejected: number
  applications: Array<{
    id: string
    date: string
    leaveType: 'ANNUAL' | 'OFF'
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    reason?: string
  }>
}

export default function StaffViewPage() {
  const [staffData, setStaffData] = useState<StaffLeaveData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null)

  useEffect(() => {
    fetchStaffData()
  }, [])

  const fetchStaffData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave-management/staff-view')
      const result = await response.json()

      if (result.success) {
        setStaffData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch staff data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (staffId: string) => {
    setExpandedStaff(expandedStaff === staffId ? null : staffId)
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

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">연차 관리 - 직원별뷰</h1>
        <p>로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">연차 관리 - 직원별뷰</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {staffData.map((staff) => (
          <Card key={staff.staffId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{staff.staffName}</CardTitle>
                  <span className="text-sm text-gray-500">({staff.staffRank})</span>
                </div>
                <button
                  onClick={() => toggleExpanded(staff.staffId)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {expandedStaff === staff.staffId ? '접기' : '자세히'}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {/* 요약 통계 */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-2xl font-bold">{staff.totalApplications}</div>
                  <div className="text-xs text-gray-500">총 신청</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 rounded">
                  <div className="text-2xl font-bold text-yellow-600">{staff.pending}</div>
                  <div className="text-xs text-gray-500">대기</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="text-2xl font-bold text-green-600">{staff.approved}</div>
                  <div className="text-xs text-gray-500">승인</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded">
                  <div className="text-2xl font-bold text-red-600">{staff.rejected}</div>
                  <div className="text-xs text-gray-500">거절</div>
                </div>
              </div>

              {/* 상세 내역 (확장 시) */}
              {expandedStaff === staff.staffId && (
                <div className="border-t pt-4 space-y-2">
                  <div className="font-semibold text-sm mb-2">신청 내역</div>
                  {staff.applications.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      신청 내역이 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {staff.applications.map((app) => (
                        <div
                          key={app.id}
                          className="text-sm border rounded p-2 hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{app.date}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {app.leaveType === 'ANNUAL' ? '연차' : '오프'}
                              </Badge>
                              {getStatusBadge(app.status)}
                            </div>
                          </div>
                          {app.reason && (
                            <div className="text-xs text-gray-600">
                              사유: {app.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {staffData.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-gray-500 text-center">직원 데이터가 없습니다.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
