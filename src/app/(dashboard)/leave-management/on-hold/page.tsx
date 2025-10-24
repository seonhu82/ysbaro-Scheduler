'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, User, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface OnHoldApplication {
  id: string
  date: Date
  leaveType: 'ANNUAL' | 'OFF'
  holdReason: string | null
  staff: {
    name: string
    categoryName: string
    departmentName: string
  }
}

export default function OnHoldManagementPage() {
  const { toast } = useToast()
  const [applications, setApplications] = useState<OnHoldApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/leave-management/on-hold')
      const data = await response.json()

      if (data.success) {
        setApplications(data.applications)
      }
    } catch (error) {
      console.error('Failed to fetch ON_HOLD applications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  const handleAction = async (applicationId: string, action: 'approve' | 'reject') => {
    setProcessing(applicationId)

    try {
      const response = await fetch('/api/leave-management/on-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, action })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: action === 'approve' ? '승인 완료' : '반려 완료',
          description: data.message
        })

        // 목록 새로고침
        fetchApplications()
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({
        title: '처리 실패',
        description: error.message || '다시 시도해주세요',
        variant: 'destructive'
      })
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">보류 신청 관리</h1>
        <p className="text-gray-600">
          구분별 슬롯 부족으로 보류된 연차/오프 신청을 관리합니다
        </p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            보류된 신청이 없습니다
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" />
                        보류
                      </Badge>
                      <Badge variant={app.leaveType === 'ANNUAL' ? 'default' : 'secondary'}>
                        {app.leaveType === 'ANNUAL' ? '연차' : '오프'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">직원</div>
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{app.staff.name}</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 mb-1">구분</div>
                        <div className="font-medium">{app.staff.categoryName}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 mb-1">부서</div>
                        <div className="font-medium">{app.staff.departmentName}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500 mb-1">날짜</div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {new Date(app.date).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {app.holdReason && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="text-sm text-amber-900">
                          <span className="font-semibold">보류 사유: </span>
                          {app.holdReason}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-200 text-green-700 hover:bg-green-50"
                      onClick={() => handleAction(app.id, 'approve')}
                      disabled={processing === app.id}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      승인
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => handleAction(app.id, 'reject')}
                      disabled={processing === app.id}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      반려
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
