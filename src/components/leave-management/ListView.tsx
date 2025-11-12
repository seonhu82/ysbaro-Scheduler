'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ON_HOLD' | 'REJECTED'
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

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기중',
  CONFIRMED: '승인',
  CANCELLED: '취소',
  ON_HOLD: '보류',
  REJECTED: '반려',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  ON_HOLD: 'bg-orange-100 text-orange-800',
  REJECTED: 'bg-red-100 text-red-800',
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
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [sortBy, setSortBy] = useState<'createdAt' | 'date' | 'name'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<LeaveApplication | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

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

  const handleBulkAction = async (newStatus: 'CONFIRMED' | 'CANCELLED') => {
    if (selectedIds.size === 0) {
      toast({
        variant: 'destructive',
        title: '선택 오류',
        description: '선택된 항목이 없습니다.',
      })
      return
    }

    const action = newStatus === 'CONFIRMED' ? '승인' : '취소'
    if (!confirm(`선택한 ${selectedIds.size}건을 ${action}하시겠습니까?`)) {
      return
    }

    try {
      setBulkProcessing(true)
      let successCount = 0
      let failCount = 0

      for (const id of selectedIds) {
        try {
          const response = await fetch(`/api/leave-management/${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus }),
          })

          const result = await response.json()
          if (result.success) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          failCount++
        }
      }

      toast({
        title: `일괄 ${action} 완료`,
        description: `성공: ${successCount}건, 실패: ${failCount}건`,
        variant: failCount > 0 ? 'destructive' : 'default',
      })

      setSelectedIds(new Set())
      fetchApplications()
    } catch (error) {
      console.error('Failed bulk action:', error)
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '일괄 처리 중 오류가 발생했습니다.',
      })
    } finally {
      setBulkProcessing(false)
    }
  }

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedIds(newSelection)
  }

  const toggleSelectAll = () => {
    const pendingApplications = filteredApplications.filter(app => app.status === 'PENDING')
    if (selectedIds.size === pendingApplications.length && pendingApplications.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingApplications.map(app => app.id)))
    }
  }

  // 검색어 및 유형 필터링
  const filteredApplications = applications
    .filter((app) => {
      if (!searchTerm) return true
      const searchLower = searchTerm.toLowerCase()
      return (
        app.staff.name.toLowerCase().includes(searchLower) ||
        app.staff.email?.toLowerCase().includes(searchLower) ||
        RANK_LABELS[app.staff.rank]?.toLowerCase().includes(searchLower)
      )
    })
    .filter((app) => {
      if (typeFilter === 'all') return true
      return app.leaveType === typeFilter
    })
    .sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
          break
        case 'name':
          comparison = a.staff.name.localeCompare(b.staff.name, 'ko-KR')
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

  const pendingCount = filteredApplications.filter(app => app.status === 'PENDING').length
  const selectedCount = selectedIds.size

  return (
    <div className="space-y-4">
      {/* 일괄 작업 버튼 */}
      {selectedCount > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedCount}개 항목 선택됨
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('CONFIRMED')}
                disabled={bulkProcessing}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Check className="w-4 h-4 mr-1" />
                일괄 승인
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('CANCELLED')}
                disabled={bulkProcessing}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-1" />
                일괄 취소
              </Button>
            </div>
          </div>
        </Card>
      )}

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

          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="PENDING">대기중</SelectItem>
                <SelectItem value="CONFIRMED">승인</SelectItem>
                <SelectItem value="CANCELLED">취소</SelectItem>
                <SelectItem value="ON_HOLD">보류</SelectItem>
                <SelectItem value="REJECTED">반려</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 유형</SelectItem>
                <SelectItem value="ANNUAL">연차</SelectItem>
                <SelectItem value="OFF">오프</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'createdAt' | 'date' | 'name')}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">신청순</SelectItem>
                <SelectItem value="date">날짜순</SelectItem>
                <SelectItem value="name">직원순</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">↓ 내림차순</SelectItem>
                <SelectItem value="asc">↑ 오름차순</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-[150px]"
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
                <th className="px-4 py-3 text-left">
                  <Checkbox
                    checked={pendingCount > 0 && selectedCount === pendingCount}
                    onCheckedChange={toggleSelectAll}
                    disabled={pendingCount === 0}
                  />
                </th>
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
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    로딩 중...
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    연차 신청 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      {app.status === 'PENDING' && (
                        <Checkbox
                          checked={selectedIds.has(app.id)}
                          onCheckedChange={() => toggleSelection(app.id)}
                        />
                      )}
                    </td>
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
                        {app.status === 'PENDING' ? (
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
                        ) : app.status === 'CONFIRMED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(app.id, 'PENDING')}
                            className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          >
                            대기로 변경
                          </Button>
                        ) : app.status === 'CANCELLED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(app.id, 'PENDING')}
                            className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          >
                            대기로 변경
                          </Button>
                        ) : null}
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
