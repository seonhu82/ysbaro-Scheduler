/**
 * 직원용 신청 내역 페이지
 * - PIN으로 인증 후 본인의 연차/오프 신청 내역 조회
 * - 상태별 명확한 메시지 표시 (PENDING/ON_HOLD/CONFIRMED/REJECTED)
 */

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calendar, AlertCircle, CheckCircle, Clock, XCircle, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Application {
  id: string
  date: string
  leaveType: 'ANNUAL' | 'OFF'
  status: 'PENDING' | 'ON_HOLD' | 'CONFIRMED' | 'REJECTED'
  holdReason?: string
  rejectionReason?: string
  createdAt: string
}

export default function MyApplicationsPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [pin, setPin] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [applications, setApplications] = useState<Application[]>([])
  const [staffName, setStaffName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAuth = async () => {
    if (!pin || pin.length !== 4) {
      setError('4자리 PIN을 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/leave-apply/${token}/my-applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })

      const data = await response.json()

      if (data.success) {
        setAuthenticated(true)
        setApplications(data.applications)
        setStaffName(data.staffName)
      } else {
        setError(data.error || '인증에 실패했습니다.')
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge className="bg-green-500 hover:bg-green-600">승인</Badge>
      case 'PENDING':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">대기</Badge>
      case 'ON_HOLD':
        return <Badge className="bg-orange-500 hover:bg-orange-600">보류</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-500 hover:bg-red-600">거절</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'ON_HOLD':
        return <AlertCircle className="w-5 h-5 text-orange-500" />
      case 'REJECTED':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Calendar className="w-5 h-5" />
    }
  }

  const getStatusMessage = (app: Application) => {
    switch (app.status) {
      case 'CONFIRMED':
        return '✅ 승인되었습니다.'
      case 'PENDING':
        return '⏰ 검토 중입니다. 잠시만 기다려주세요.'
      case 'ON_HOLD':
        return app.holdReason || '⏳ 보류 - 스케줄 확정 후 재검토됩니다.'
      case 'REJECTED':
        return app.rejectionReason || '❌ 거절되었습니다. 다른 날짜를 선택해주세요.'
      default:
        return ''
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Calendar className="w-6 h-6" />
              내 신청 내역 조회
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">PIN 입력</label>
              <Input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="4자리 PIN"
                className="text-center text-2xl tracking-widest"
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              onClick={handleAuth}
              disabled={loading || pin.length !== 4}
              className="w-full"
            >
              {loading ? '확인 중...' : '조회하기'}
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push(`/leave-apply/${token}`)}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              신청 페이지로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* 헤더 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{staffName}님의 신청 내역</h1>
                <p className="text-sm text-gray-500 mt-1">
                  총 {applications.length}건의 신청
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setAuthenticated(false)
                  setPin('')
                  setApplications([])
                }}
              >
                로그아웃
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 신청 목록 */}
        {applications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">아직 신청 내역이 없습니다.</p>
              <Button
                variant="link"
                onClick={() => router.push(`/leave-apply/${token}`)}
                className="mt-4"
              >
                연차/오프 신청하기 →
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {applications
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((app) => (
                <Card key={app.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* 아이콘 */}
                      <div className="flex-shrink-0 mt-1">{getStatusIcon(app.status)}</div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg font-semibold">
                                {format(new Date(app.date), 'yyyy년 M월 d일 (E)', { locale: ko })}
                              </span>
                              <Badge variant={app.leaveType === 'ANNUAL' ? 'default' : 'secondary'}>
                                {app.leaveType === 'ANNUAL' ? '연차' : '오프'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500">
                              신청일: {format(new Date(app.createdAt), 'yyyy-MM-dd HH:mm')}
                            </p>
                          </div>
                          {getStatusBadge(app.status)}
                        </div>

                        {/* 상태 메시지 */}
                        <div
                          className={`mt-3 p-3 rounded-lg text-sm ${
                            app.status === 'CONFIRMED'
                              ? 'bg-green-50 text-green-700'
                              : app.status === 'PENDING'
                              ? 'bg-yellow-50 text-yellow-700'
                              : app.status === 'ON_HOLD'
                              ? 'bg-orange-50 text-orange-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {getStatusMessage(app)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push(`/leave-apply/${token}`)}
            className="flex-1"
          >
            <Calendar className="w-4 h-4 mr-2" />
            새 신청하기
          </Button>
        </div>
      </div>
    </div>
  )
}
