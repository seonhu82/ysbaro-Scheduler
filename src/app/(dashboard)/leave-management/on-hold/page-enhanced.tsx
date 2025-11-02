/**
 * ON_HOLD 연차/오프 관리 페이지 (향상된 버전)
 * 경로: /leave-management/on-hold
 *
 * 기능:
 * - ON_HOLD 상태 신청 목록
 * - Bulk 승인/거절 작업
 * - 개별 재검토
 * - 보류 사유 확인
 * - 자동 재검토
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Clock, CheckCircle, XCircle, RefreshCw,
  AlertCircle, Calendar, Users
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface OnHoldApplication {
  id: string
  staffName: string
  categoryName: string
  date: string
  leaveType: 'ANNUAL' | 'OFF'
  holdReason: string
  fairnessScore?: number
  createdAt: string
}

export default function OnHoldManagementPage() {
  const { toast } = useToast()
  const [applications, setApplications] = useState<OnHoldApplication[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    fetchOnHoldApplications()
  }, [selectedYear, selectedMonth])

  const fetchOnHoldApplications = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/leave-management/on-hold/list?year=${selectedYear}&month=${selectedMonth}`
      )
      const data = await response.json()

      if (data.success) {
        setApplications(data.applications || [])
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: data.error
        })
      }
    } catch (error) {
      console.error('Failed to fetch ON_HOLD applications:', error)
      toast({
        variant: 'destructive',
        title: '오류',
        description: 'ON_HOLD 신청을 불러올 수 없습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === applications.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(applications.map(app => app.id)))
    }
  }

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) {
      toast({
        variant: 'destructive',
        title: '선택 필요',
        description: '승인할 신청을 선택해주세요'
      })
      return
    }

    if (!confirm(`선택한 ${selectedIds.size}건을 승인하시겠습니까?`)) {
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/leave-management/on-hold/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: Array.from(selectedIds),
          action: 'APPROVE'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '일괄 승인 완료',
          description: `${data.successCount}건이 승인되었습니다`
        })
        setSelectedIds(new Set())
        fetchOnHoldApplications()
      } else {
        toast({
          variant: 'destructive',
          title: '일괄 승인 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '일괄 승인 중 오류가 발생했습니다'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleBulkReject = async () => {
    if (selectedIds.size === 0) {
      toast({
        variant: 'destructive',
        title: '선택 필요',
        description: '거절할 신청을 선택해주세요'
      })
      return
    }

    if (!confirm(`선택한 ${selectedIds.size}건을 거절하시겠습니까?`)) {
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/leave-management/on-hold/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: Array.from(selectedIds),
          action: 'REJECT'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '일괄 거절 완료',
          description: `${data.successCount}건이 거절되었습니다`
        })
        setSelectedIds(new Set())
        fetchOnHoldApplications()
      } else {
        toast({
          variant: 'destructive',
          title: '일괄 거절 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '일괄 거절 중 오류가 발생했습니다'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleAutoReview = async () => {
    if (!confirm(`${selectedYear}년 ${selectedMonth}월 ON_HOLD 신청을 자동으로 재검토하시겠습니까?`)) {
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/leave-management/process-on-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          month: selectedMonth
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '자동 재검토 완료',
          description: `승인 ${data.results.approved}건, 거절 ${data.results.rejected}건, 보류 ${data.results.remainOnHold}건`
        })
        fetchOnHoldApplications()
      } else {
        toast({
          variant: 'destructive',
          title: '자동 재검토 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '자동 재검토 중 오류가 발생했습니다'
      })
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">ON_HOLD 신청 로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="w-8 h-8 text-orange-500" />
            ON_HOLD 관리
          </h1>
          <p className="text-gray-600 mt-1">보류 중인 연차/오프 신청 관리</p>
        </div>

        {/* 월 선택 */}
        <div className="flex items-center gap-3">
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-32">
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

          <Select
            value={selectedMonth.toString()}
            onValueChange={(value) => setSelectedMonth(parseInt(value))}
          >
            <SelectTrigger className="w-32">
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

          <Button onClick={fetchOnHoldApplications} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              보류 중
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {applications.length}
            </div>
            <div className="text-sm text-gray-500 mt-1">총 신청 건수</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              선택됨
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {selectedIds.size}
            </div>
            <div className="text-sm text-gray-500 mt-1">선택된 건수</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              기간
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-gray-900">
              {selectedYear}년 {selectedMonth}월
            </div>
            <div className="text-sm text-gray-500 mt-1">조회 기간</div>
          </CardContent>
        </Card>
      </div>

      {/* 일괄 작업 버튼 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-medium text-blue-900">일괄 작업</div>
                <div className="text-sm text-blue-700">
                  {selectedIds.size}건 선택됨
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleAutoReview}
                disabled={processing || applications.length === 0}
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                자동 재검토
              </Button>
              <Button
                onClick={handleBulkApprove}
                disabled={processing || selectedIds.size === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                일괄 승인
              </Button>
              <Button
                onClick={handleBulkReject}
                disabled={processing || selectedIds.size === 0}
                variant="destructive"
              >
                <XCircle className="w-4 h-4 mr-2" />
                일괄 거절
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 신청 목록 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>보류 신청 목록</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size === applications.length && applications.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-gray-600">전체 선택</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">ON_HOLD 상태의 신청이 없습니다</p>
              <p className="text-sm mt-2">모든 신청이 승인 또는 거절되었습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map(app => (
                <div
                  key={app.id}
                  className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                    selectedIds.has(app.id) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* 체크박스 */}
                  <Checkbox
                    checked={selectedIds.has(app.id)}
                    onCheckedChange={() => toggleSelection(app.id)}
                  />

                  {/* 직원 정보 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="font-medium text-lg">{app.staffName}</div>
                      <Badge variant="outline">{app.categoryName}</Badge>
                      <Badge variant={app.leaveType === 'ANNUAL' ? 'default' : 'secondary'}>
                        {app.leaveType === 'ANNUAL' ? '연차' : '오프'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(app.date), 'yyyy년 M월 d일 (E)', { locale: ko })}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {format(new Date(app.createdAt), 'M/d HH:mm')}
                      </div>
                      {app.fairnessScore !== undefined && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">형평성:</span>
                          <span className={
                            app.fairnessScore >= 75 ? 'text-green-600' :
                            app.fairnessScore >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }>
                            {app.fairnessScore}점
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 보류 사유 */}
                  <div className="w-80 p-3 bg-orange-50 border border-orange-200 rounded">
                    <div className="text-xs text-orange-800 font-medium mb-1">보류 사유:</div>
                    <div className="text-sm text-orange-900">{app.holdReason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 안내 */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="p-6">
          <h3 className="font-bold text-purple-900 mb-3">⏳ ON_HOLD 관리 가이드</h3>
          <div className="space-y-2 text-sm text-purple-800">
            <p>• <strong>자동 재검토</strong>: 형평성과 슬롯 가용성을 재계산하여 자동으로 승인/거절 처리합니다</p>
            <p>• <strong>일괄 승인</strong>: 선택한 신청을 수동으로 승인 처리합니다</p>
            <p>• <strong>일괄 거절</strong>: 선택한 신청을 거절 처리합니다</p>
            <p>• 스케줄 배포 시 자동으로 재검토가 실행됩니다</p>
            <p>• 보류 사유를 확인하여 승인/거절을 결정하세요</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
