'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Check, X, RefreshCw, Search, Filter, Edit, Trash2 } from 'lucide-react'
import { LeaveDetailDialog } from './LeaveDetailDialog'

type LeaveApplication = {
  id: string
  date: string
  leaveType: 'ANNUAL' | 'OFF'
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  staff: {
    id: string
    name: string
    rank: string
    email: string | null
  }
  link: {
    id: string
    year: number
    month: number
    token: string
    status: string
  }
  createdAt: string
}

const STATUS_LABELS = {
  PENDING: '대기중',
  CONFIRMED: '승인',
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

const RANK_LABELS: Record<string, string> = {
  HYGIENIST: '위생사',
  ASSISTANT: '어시스턴트',
  COORDINATOR: '코디',
  NURSE: '간호',
  OTHER: '기타',
}

export function ListView() {
  const { toast } = useToast()
  const [applications, setApplications] = useState<LeaveApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<LeaveApplication | null>(null)

  const fetchApplications = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (monthFilter) {
        params.append('month', monthFilter)
      }

      const response = await fetch(`/api/leave-management/list-view?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setApplications(result.data)
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: result.error || '연차 신청 내역을 불러오는데 실패했습니다.',
        })
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error)
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [statusFilter, monthFilter])

  const handleStatusChange = async (applicationId: string, newStatus: 'CONFIRMED' | 'CANCELLED') => {
    try {
      const response = await fetch(`/api/leave-management/${applicationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: newStatus === 'CONFIRMED' ? '승인 완료' : '취소 완료',
          description: `연차 신청이 ${newStatus === 'CONFIRMED' ? '승인' : '취소'}되었습니다.`,
        })
        fetchApplications()
      } else {
        toast({
          variant: 'destructive',
          title: '처리 실패',
          description: result.error || '상태 변경에 실패했습니다.',
        })
      }
    } catch (error) {
      console.error('Failed to change status:', error)
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다.',
      })
    }
  }

  // 검색어 필터링
  const filteredApplications = applications.filter((app) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      app.staff.name.toLowerCase().includes(searchLower) ||
      app.staff.email?.toLowerCase().includes(searchLower) ||
      RANK_LABELS[app.staff.rank]?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="space-y-4">
      {/* 필터 및 검색 */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="이름, 이메일, 직급으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="PENDING">대기중</SelectItem>
                <SelectItem value="CONFIRMED">승인</SelectItem>
                <SelectItem value="CANCELLED">취소</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-[160px]"
            />

            <Button
              variant="outline"
              size="icon"
              onClick={fetchApplications}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </Card>

      {/* 테이블 */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  직원
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  직급
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  신청 기간
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    로딩 중...
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    연차 신청 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Date(app.date).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {app.staff.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {RANK_LABELS[app.staff.rank] || app.staff.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Badge variant="outline">
                        {LEAVE_TYPE_LABELS[app.leaveType]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Badge className={STATUS_COLORS[app.status]}>
                        {STATUS_LABELS[app.status]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {app.link.year}년 {app.link.month}월
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end gap-2">
                        {app.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(app.id, 'CONFIRMED')}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              승인
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(app.id, 'CANCELLED')}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4 mr-1" />
                              취소
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedApplication(app)
                            setDetailDialogOpen(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 통계 푸터 */}
        {!loading && filteredApplications.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t">
            <div className="flex justify-between text-sm text-gray-600">
              <span>총 {filteredApplications.length}건</span>
              <div className="flex gap-4">
                <span>
                  대기:{' '}
                  <span className="font-semibold text-yellow-600">
                    {filteredApplications.filter((a) => a.status === 'PENDING').length}
                  </span>
                </span>
                <span>
                  승인:{' '}
                  <span className="font-semibold text-green-600">
                    {filteredApplications.filter((a) => a.status === 'CONFIRMED').length}
                  </span>
                </span>
                <span>
                  취소:{' '}
                  <span className="font-semibold text-gray-600">
                    {filteredApplications.filter((a) => a.status === 'CANCELLED').length}
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 연차/오프 상세 다이얼로그 */}
      <LeaveDetailDialog
        open={detailDialogOpen}
        onClose={(updated) => {
          setDetailDialogOpen(false)
          setSelectedApplication(null)
          if (updated) {
            fetchApplications()
          }
        }}
        application={selectedApplication}
      />
    </div>
  )
}
