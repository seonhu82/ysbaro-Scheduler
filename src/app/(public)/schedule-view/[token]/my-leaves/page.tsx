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
  holdReason?: string
  year: number
  month: number
}

interface Statistics {
  total: number
  pending: number
  confirmed: number
  onHold: number
  rejected: number
  annual: number
  off: number
}

export default function MyLeavesPage({
  params,
}: {
  params: { token: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [applicationsByMonth, setApplicationsByMonth] = useState<Record<string, LeaveApplication[]>>({})
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
        setStatistics(data.data.statistics)
        setApplicationsByMonth(data.data.applicationsByMonth)
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
        <p className="text-gray-600">{staffName}님의 신청 내역 ({new Date().getFullYear()}년)</p>
      </div>

      {/* 통계 */}
      {statistics && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">신청 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">총 신청</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.total}</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">승인</p>
                <p className="text-2xl font-bold text-green-600">{statistics.confirmed}</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">대기/보류</p>
                <p className="text-2xl font-bold text-yellow-600">{statistics.pending + statistics.onHold}</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-1">반려</p>
                <p className="text-2xl font-bold text-red-600">{statistics.rejected}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center p-2 bg-purple-50 rounded">
                <p className="text-xs text-gray-600 mb-1">연차</p>
                <p className="text-xl font-bold text-purple-600">{statistics.annual}</p>
              </div>
              <div className="text-center p-2 bg-amber-50 rounded">
                <p className="text-xs text-gray-600 mb-1">오프</p>
                <p className="text-xl font-bold text-amber-600">{statistics.off}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 월별 신청 내역 */}
      {Object.keys(applicationsByMonth).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">신청 내역이 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.keys(applicationsByMonth)
            .sort()
            .reverse()
            .map((monthKey) => {
              const apps = applicationsByMonth[monthKey]
              const [year, month] = monthKey.split('-')
              return (
                <Card key={monthKey}>
                  <CardHeader>
                    <CardTitle className="text-lg">{year}년 {parseInt(month)}월</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {apps.map((app) => (
                        <div key={app.id} className="p-3 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold">
                                {new Date(app.date).toLocaleDateString('ko-KR', {
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
                          </div>

                          {/* 보류 사유 */}
                          {app.status === 'ON_HOLD' && app.holdReason && (
                            <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                              <p className="text-xs font-semibold text-yellow-800 mb-1">보류 사유</p>
                              <p className="text-xs text-yellow-700">{app.holdReason}</p>
                            </div>
                          )}

                          {/* 반려 사유 */}
                          {app.status === 'REJECTED' && app.reason && (
                            <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                              <p className="text-xs font-semibold text-red-800 mb-1">반려 사유</p>
                              <p className="text-xs text-red-700">{app.reason}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
        </div>
      )}
    </div>
  )
}
