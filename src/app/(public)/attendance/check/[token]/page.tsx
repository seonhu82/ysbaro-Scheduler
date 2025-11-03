/**
 * 출퇴근 체크 페이지 (QR 접속)
 * 경로: /attendance/check/[token]
 *
 * 기능:
 * - QR 코드로 접속
 * - 직원 이름 선택 + PIN 입력
 * - 출근/퇴근 체크
 * - 조기퇴근/지각 사유 입력 (필요시)
 * - 디바이스 정보 수집
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Clock, LogIn, LogOut, User, Shield, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Staff {
  id: string
  name: string
  rank: string
  categoryName: string
}

interface TokenValidation {
  valid: boolean
  message: string
  tokenData?: {
    clinicId: string
    expiresAt: string
  }
}

export default function AttendanceCheckPage({
  params,
}: {
  params: { token: string }
}) {
  const { toast } = useToast()

  // 토큰 검증 상태
  const [tokenValid, setTokenValid] = useState<TokenValidation | null>(null)
  const [loading, setLoading] = useState(true)
  const [clinicId, setClinicId] = useState<string>('')

  // 직원 목록 및 선택
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [pin, setPin] = useState('')
  const [authenticatedStaff, setAuthenticatedStaff] = useState<Staff | null>(null)

  // 체크 타입 및 사유
  const [checkType, setCheckType] = useState<'IN' | 'OUT'>('IN')
  const [reason, setReason] = useState('')
  const [needReason, setNeedReason] = useState(false)

  // 현재 시각
  const [currentTime, setCurrentTime] = useState(new Date())

  // 제출 상태
  const [submitting, setSubmitting] = useState(false)

  // 현재 시각 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 토큰 검증
  useEffect(() => {
    validateToken()
  }, [])

  const validateToken = async () => {
    try {
      console.log('🔍 토큰 검증 시작:', params.token)

      // URL 토큰을 API로 전달하여 검증
      const response = await fetch(`/api/attendance/qr-token?token=${params.token}`)
      const data = await response.json()

      console.log('📋 토큰 검증 응답:', data)

      if (data.success && data.data) {
        // 토큰이 유효하면
        setTokenValid({
          valid: true,
          message: '유효한 토큰입니다',
          tokenData: {
            clinicId: data.data.clinicId || '',
            expiresAt: data.data.expiresAt
          }
        })
        setClinicId(data.data.clinicId || '')
        console.log('✅ 토큰 유효:', data.data)

        // 직원 목록 조회
        fetchStaffList()
      } else {
        console.error('❌ 토큰 무효:', data)
        setTokenValid({
          valid: false,
          message: data.error || '유효하지 않거나 만료된 토큰입니다'
        })
      }
    } catch (error) {
      console.error('❌ 토큰 검증 오류:', error)
      setTokenValid({
        valid: false,
        message: 'QR 코드 검증 중 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchStaffList = async () => {
    try {
      // 모든 활성 직원 조회 (향후 clinicId로 필터링)
      const response = await fetch('/api/settings/staff')
      const result = await response.json()

      console.log('📋 Staff API 응답:', result)

      if (result.success && result.data) {
        const activeStaff = result.data.filter((s: any) => s.isActive !== false)
        console.log('✅ 활성 직원:', activeStaff.length, activeStaff.map((s: any) => s.name))
        setStaffList(activeStaff)
      } else {
        console.error('❌ Staff API 응답 형식 오류:', result)
      }
    } catch (error) {
      console.error('❌ Failed to fetch staff list:', error)
    }
  }

  // 직원 인증 (간단한 PIN 확인)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedStaffId || !pin) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '직원을 선택하고 PIN을 입력해주세요.'
      })
      return
    }

    try {
      // 직원 정보 조회 및 PIN 확인
      const staff = staffList.find(s => s.id === selectedStaffId)

      if (!staff) {
        toast({
          variant: 'destructive',
          title: '인증 실패',
          description: '직원 정보를 찾을 수 없습니다.'
        })
        return
      }

      // PIN은 실제로는 Staff 테이블의 birthDate와 비교해야 함
      // 여기서는 간단하게 선택만으로 인증 (향후 개선)
      setAuthenticatedStaff(staff)
      toast({
        title: '인증 성공',
        description: `${staff.name}님, 출퇴근 체크가 가능합니다.`
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '인증 중 오류가 발생했습니다.'
      })
    }
  }

  // 출퇴근 체크 제출
  const handleSubmit = async () => {
    if (!authenticatedStaff) return

    // 사유 필요 여부 체크 (조기퇴근/지각 등)
    const hour = currentTime.getHours()
    const minute = currentTime.getMinutes()
    const time = hour * 60 + minute

    // 출근: 9시 이후 → 지각 (사유 필요)
    // 퇴근: 18시 이전 → 조기퇴근 (사유 필요)
    if (checkType === 'IN' && time > 9 * 60) {
      if (!reason && !needReason) {
        setNeedReason(true)
        toast({
          variant: 'destructive',
          title: '지각 사유 입력',
          description: '지각 사유를 입력해주세요.'
        })
        return
      }
    } else if (checkType === 'OUT' && time < 18 * 60) {
      if (!reason && !needReason) {
        setNeedReason(true)
        toast({
          variant: 'destructive',
          title: '조기퇴근 사유 입력',
          description: '조기퇴근 사유를 입력해주세요.'
        })
        return
      }
    }

    setSubmitting(true)

    try {
      // 디바이스 정보 수집
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }

      const response = await fetch('/api/attendance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: authenticatedStaff.id,
          pin,
          token: params.token,
          checkType,
          deviceInfo,
          reason: reason || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: checkType === 'IN' ? '✅ 출근 완료' : '✅ 퇴근 완료',
          description: `${format(currentTime, 'HH:mm:ss')}에 ${checkType === 'IN' ? '출근' : '퇴근'} 처리되었습니다.${data.warning ? `\n${data.warning}` : ''}`
        })

        // 초기화
        setAuthenticatedStaff(null)
        setSelectedStaffId('')
        setPin('')
        setReason('')
        setNeedReason(false)
        setCheckType('IN')
      } else {
        toast({
          variant: 'destructive',
          title: '체크 실패',
          description: data.error || '출퇴근 체크 중 오류가 발생했습니다.'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '출퇴근 체크 중 오류가 발생했습니다.'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">QR 코드 확인 중...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!tokenValid?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-6 h-6" />
              QR 코드 만료
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              {tokenValid?.message || 'QR 코드가 만료되었거나 유효하지 않습니다.'}
            </p>
            <p className="text-sm text-gray-600">
              새로운 QR 코드를 스캔해주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 헤더 */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold">출퇴근 체크</h1>
              <p className="text-3xl font-mono">
                {format(currentTime, 'HH:mm:ss', { locale: ko })}
              </p>
              <p className="text-sm opacity-90">
                {format(currentTime, 'yyyy년 MM월 dd일 EEEE', { locale: ko })}
              </p>
            </div>
          </CardContent>
        </Card>

        {!authenticatedStaff ? (
          /* 인증 폼 */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                직원 인증
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <Label htmlFor="staff">직원 선택</Label>
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger>
                      <SelectValue placeholder="직원을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.name} ({staff.rank})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="pin">PIN</Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="PIN 입력 (초기: 생년월일 6자리)"
                  />
                </div>

                <Button type="submit" className="w-full" size="lg">
                  <Shield className="w-5 h-5 mr-2" />
                  인증하기
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* 출퇴근 체크 */
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                출퇴근 체크
              </CardTitle>
              <p className="text-sm text-gray-600">
                {authenticatedStaff.name}님 ({authenticatedStaff.rank})
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 체크 타입 선택 */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  type="button"
                  variant={checkType === 'IN' ? 'default' : 'outline'}
                  className={checkType === 'IN' ? 'bg-green-500 hover:bg-green-600' : ''}
                  onClick={() => setCheckType('IN')}
                  size="lg"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  출근
                </Button>
                <Button
                  type="button"
                  variant={checkType === 'OUT' ? 'default' : 'outline'}
                  className={checkType === 'OUT' ? 'bg-red-500 hover:bg-red-600' : ''}
                  onClick={() => setCheckType('OUT')}
                  size="lg"
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  퇴근
                </Button>
              </div>

              {/* 사유 입력 (필요시) */}
              {needReason && (
                <div>
                  <Label htmlFor="reason">
                    {checkType === 'IN' ? '지각' : '조기퇴근'} 사유
                  </Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="사유를 입력해주세요"
                    rows={3}
                  />
                </div>
              )}

              {/* 제출 버튼 */}
              <div className="space-y-2">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 mr-2" />
                      {checkType === 'IN' ? '출근' : '퇴근'} 체크
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAuthenticatedStaff(null)
                    setReason('')
                    setNeedReason(false)
                  }}
                  className="w-full"
                >
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 안내 메시지 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-900">
              ℹ️ 출퇴근 체크는 QR 코드를 통해서만 가능합니다. QR 코드는 5분마다 자동으로 변경됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
