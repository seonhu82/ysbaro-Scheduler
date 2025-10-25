'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock, UserCheck, Calendar } from 'lucide-react'

interface ScheduleAuthProps {
  token: string
  onAuthSuccess: (staffId: string, staffName: string) => void
}

export function ScheduleAuth({ token, onAuthSuccess }: ScheduleAuthProps) {
  const [authMode, setAuthMode] = useState<'select' | 'birthdate' | 'pin'>('select')
  const [staffName, setStaffName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [availableStaff, setAvailableStaff] = useState<Array<{ id: string; name: string }>>([])

  // 스태프 목록 로드 (토큰 기반)
  const loadStaffList = async () => {
    try {
      const response = await fetch(`/api/public/schedule-view/${token}/staff`)
      const data = await response.json()
      if (data.success) {
        setAvailableStaff(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load staff list:', error)
    }
  }

  // 생년월일 인증
  const handleBirthdateAuth = async () => {
    if (!staffName || !birthdate) {
      setError('이름과 생년월일을 모두 입력해주세요')
      return
    }

    if (birthdate.length !== 6) {
      setError('생년월일은 6자리 숫자로 입력해주세요 (예: 850315)')
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/public/schedule-view/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authType: 'birthdate',
          staffName,
          birthdate,
        }),
      })

      const data = await response.json()

      if (data.success) {
        onAuthSuccess(data.data.staffId, data.data.staffName)
      } else {
        setError(data.error || '인증에 실패했습니다')
      }
    } catch (error) {
      setError('서버 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  // PIN 인증
  const handlePinAuth = async () => {
    if (!staffName || !pin) {
      setError('이름과 PIN을 모두 입력해주세요')
      return
    }

    if (pin.length < 4 || pin.length > 6) {
      setError('PIN은 4~6자리 숫자로 입력해주세요')
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/public/schedule-view/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authType: 'pin',
          staffName,
          pin,
        }),
      })

      const data = await response.json()

      if (data.success) {
        onAuthSuccess(data.data.staffId, data.data.staffName)
      } else {
        setError(data.error || '인증에 실패했습니다')
      }
    } catch (error) {
      setError('서버 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  // 이름 선택 화면
  if (authMode === 'select') {
    return (
      <div className="max-w-md mx-auto p-6 min-h-screen flex items-center">
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-8 h-8 text-blue-600" />
              <CardTitle className="text-2xl">근무 스케줄 조회</CardTitle>
            </div>
            <p className="text-gray-600">직원 인증이 필요합니다</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="staffName">이름</Label>
              <Input
                id="staffName"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="mt-1"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 pt-4">
              <Button
                className="w-full"
                onClick={() => {
                  if (!staffName) {
                    setError('이름을 입력해주세요')
                    return
                  }
                  setError('')
                  setAuthMode('birthdate')
                }}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                생년월일로 인증
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (!staffName) {
                    setError('이름을 입력해주세요')
                    return
                  }
                  setError('')
                  setAuthMode('pin')
                }}
              >
                <Lock className="w-4 h-4 mr-2" />
                PIN으로 인증
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 생년월일 인증 화면
  if (authMode === 'birthdate') {
    return (
      <div className="max-w-md mx-auto p-6 min-h-screen flex items-center">
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-8 h-8 text-blue-600" />
              <CardTitle className="text-2xl">생년월일 인증</CardTitle>
            </div>
            <p className="text-gray-600">{staffName}님의 생년월일을 입력하세요</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="birthdate">생년월일 (6자리)</Label>
              <Input
                id="birthdate"
                type="text"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="예: 850315 (YYMMDD)"
                maxLength={6}
                className="mt-1 text-lg tracking-widest"
              />
              <p className="text-xs text-gray-500 mt-1">
                예) 1985년 3월 15일 생 → 850315
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 pt-4">
              <Button
                className="w-full"
                onClick={handleBirthdateAuth}
                disabled={loading || birthdate.length !== 6}
              >
                {loading ? '인증 중...' : '인증하기'}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setAuthMode('select')
                  setBirthdate('')
                  setError('')
                }}
                disabled={loading}
              >
                뒤로 가기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // PIN 인증 화면
  if (authMode === 'pin') {
    return (
      <div className="max-w-md mx-auto p-6 min-h-screen flex items-center">
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-8 h-8 text-blue-600" />
              <CardTitle className="text-2xl">PIN 인증</CardTitle>
            </div>
            <p className="text-gray-600">{staffName}님의 PIN을 입력하세요</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="pin">PIN (4~6자리)</Label>
              <Input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="PIN 번호 입력"
                maxLength={6}
                className="mt-1 text-lg tracking-widest"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2 pt-4">
              <Button
                className="w-full"
                onClick={handlePinAuth}
                disabled={loading || pin.length < 4}
              >
                {loading ? '인증 중...' : '인증하기'}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setAuthMode('select')
                  setPin('')
                  setError('')
                }}
                disabled={loading}
              >
                뒤로 가기
              </Button>

              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  setAuthMode('birthdate')
                  setPin('')
                  setError('')
                }}
                disabled={loading}
              >
                생년월일로 인증하기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
