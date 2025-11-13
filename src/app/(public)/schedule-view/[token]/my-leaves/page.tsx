/**
 * 내 연차/오프 신청 내역 페이지
 * 경로: /schedule-view/[token]/my-leaves
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, Ban } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface LeaveApplication {
  id: string
  date: string
  leaveType: 'ANNUAL' | 'OFF'
  status: 'PENDING' | 'CONFIRMED' | 'ON_HOLD' | 'REJECTED'
  reason?: string
  createdAt: string
}

export default function MyLeavesPage({
  params,
}: {
  params: { token: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<LeaveApplication[]>([])
  const [staffName, setStaffName] = useState('')

  useEffect(() => {
    // 인증 확인
    const authData = sessionStorage.getItem(`schedule-auth-${params.token}`)
    if (!authData) {
      router.push(`/schedule-view/${params.token}`)
      return
    }

    const { staffId, staffName } = JSON.parse(authData)
    setStaffName(staffName)
    fetchApplications(staffId)
  }, [params.token, router])

  const fetchApplications = async (staffId: string) => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/public/schedule-view/${params.token}/my-leaves?staffId=${staffId}`
      )
      const data = await response.json()

      if (data.success) {
        setApplications(data.data)
      } else {
        toast({
          variant: 'destructive',
          title: '조회 실패',
          description: data.error || '신청 내역을 불러올 수 없습니다'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            승인
          </Badge>
        )
      case 'PENDING':
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-300">
            <Clock className="w-3 h-3 mr-1" />
            대기
          </Badge>
        )
      case 'ON_HOLD':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <Clock className="w-3 h-3 mr-1" />
            보류
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            반려
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getLeaveTypeName = (type: string) => {
    return type === 'ANNUAL' ? '연차' : '오프'
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 animate-spin text-blue-500" />
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push(`/schedule-view/${params.token}`)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          스케줄로 돌아가기
        </Button>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">내 연차/오프 신청 내역</h1>
        </div>
        <p className="text-gray-600">{staffName}님의 신청 내역</p>
      </div>

      {/* 신청 내역 목록 */}
      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">신청 내역이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-semibold">
                        {new Date(app.date).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short'
                        })}
                      </span>
                      <Badge variant="outline" className="bg-blue-50">
                        {getLeaveTypeName(app.leaveType)}
                      </Badge>
                      {getStatusBadge(app.status)}
                    </div>

                    {/* 보류/반려 사유 */}
                    {(app.status === 'ON_HOLD' || app.status === 'REJECTED') && app.reason && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-1">
                          {app.status === 'ON_HOLD' ? '보류 사유' : '반려 사유'}
                        </p>
                        <p className="text-sm text-gray-600">{app.reason}</p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      신청일: {new Date(app.createdAt).toLocaleDateString('ko-KR')}
                    </p>
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
