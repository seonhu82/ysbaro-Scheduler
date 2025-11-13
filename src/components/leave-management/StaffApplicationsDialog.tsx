'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Check, X, RefreshCw, Pause } from 'lucide-react'

type LeaveApplication = {
  id: string
  date: string
  leaveType: 'ANNUAL' | 'OFF'
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ON_HOLD'
  year: number
  month: number
}

interface StaffApplicationsDialogProps {
  open: boolean
  onClose: () => void
  staffId: string | null
  staffName: string | null
}

const STATUS_LABELS = {
  PENDING: '대기중',
  CONFIRMED: '승인',
  CANCELLED: '취소',
  ON_HOLD: '보류',
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  ON_HOLD: 'bg-orange-100 text-orange-800',
}

const LEAVE_TYPE_LABELS = {
  ANNUAL: '연차',
  OFF: '오프',
}

export function StaffApplicationsDialog({
  open,
  onClose,
  staffId,
  staffName,
}: StaffApplicationsDialogProps) {
  const { toast } = useToast()
  const [applications, setApplications] = useState<LeaveApplication[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && staffId) {
      fetchApplications()
    }
  }, [open, staffId])

  const fetchApplications = async () => {
    if (!staffId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/leave-management/staff/${staffId}/applications`)
      const result = await response.json()

      if (result.success) {
        setApplications(result.data)
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: result.error || '신청 내역을 불러오는데 실패했습니다.',
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

  const handleStatusChange = async (applicationId: string, newStatus: 'CONFIRMED' | 'CANCELLED' | 'PENDING' | 'ON_HOLD') => {
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
        const statusLabel = newStatus === 'CONFIRMED' ? '승인' : newStatus === 'CANCELLED' ? '취소' : newStatus === 'ON_HOLD' ? '보류' : '대기중'
        toast({
          title: `${statusLabel} 완료`,
          description: `연차 신청이 ${statusLabel}되었습니다.`,
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

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{staffName} - 신청 내역</DialogTitle>
          <DialogDescription>
            전체 연차/오프 신청 내역을 확인하고 관리할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
              <p className="text-gray-600">로딩 중...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">신청 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      날짜
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      유형
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      기간
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(app.date).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <Badge variant="outline">
                          {LEAVE_TYPE_LABELS[app.leaveType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <Badge className={STATUS_COLORS[app.status]}>
                          {STATUS_LABELS[app.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {app.year}년 {app.month}월
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
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
                                onClick={() => handleStatusChange(app.id, 'ON_HOLD')}
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <Pause className="w-4 h-4 mr-1" />
                                보류
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(app.id, 'CANCELLED')}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="w-4 h-4 mr-1" />
                                반려
                              </Button>
                            </>
                          ) : app.status === 'CONFIRMED' ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(app.id, 'ON_HOLD')}
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <Pause className="w-4 h-4 mr-1" />
                                보류
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(app.id, 'PENDING')}
                                className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                              >
                                대기로 변경
                              </Button>
                            </>
                          ) : app.status === 'ON_HOLD' ? (
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
                                반려
                              </Button>
                            </>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 통계 푸터 */}
          {!loading && applications.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border rounded">
              <div className="flex justify-between text-sm text-gray-600">
                <span>총 {applications.length}건</span>
                <div className="flex gap-4">
                  <span>
                    대기:{' '}
                    <span className="font-semibold text-yellow-600">
                      {applications.filter((a) => a.status === 'PENDING').length}
                    </span>
                  </span>
                  <span>
                    승인:{' '}
                    <span className="font-semibold text-green-600">
                      {applications.filter((a) => a.status === 'CONFIRMED').length}
                    </span>
                  </span>
                  <span>
                    보류:{' '}
                    <span className="font-semibold text-orange-600">
                      {applications.filter((a) => a.status === 'ON_HOLD').length}
                    </span>
                  </span>
                  <span>
                    취소:{' '}
                    <span className="font-semibold text-gray-600">
                      {applications.filter((a) => a.status === 'CANCELLED').length}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
