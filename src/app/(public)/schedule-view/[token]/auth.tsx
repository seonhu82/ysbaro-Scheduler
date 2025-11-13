'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, UserCheck } from 'lucide-react'

interface ScheduleAuthProps {
  token: string
  onAuthSuccess: (staffId: string, staffName: string) => void
}

interface StaffOption {
  id: string
  name: string
}

export function ScheduleAuth({ token, onAuthSuccess }: ScheduleAuthProps) {
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [error, setError] = useState('')

  // 스태프 목록 로드
  useEffect(() => {
    loadStaffList()
  }, [])

  const loadStaffList = async () => {
    try {
      setLoadingStaff(true)
      const response = await fetch(`/api/public/schedule-view/${token}/staff`)
      const data = await response.json()

      if (data.success) {
        setStaffList(data.data || [])
      } else {
        setError('직원 목록을 불러올 수 없습니다')
      }
    } catch (error) {
      console.error('Failed to load staff list:', error)
      setError('서버 오류가 발생했습니다')
    } finally {
      setLoadingStaff(false)
    }
  }

  // 인증 처리
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedStaffId) {
      setError('직원을 선택해주세요')
      return
    }

    if (!pinCode) {
      setError('PIN 번호를 입력해주세요')
      return
    }

    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/public/schedule-view/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaffId,
          pinCode,
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
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Label htmlFor="staff">이름</Label>
              <Select
                value={selectedStaffId}
                onValueChange={setSelectedStaffId}
                disabled={loadingStaff}
              >
                <SelectTrigger id="staff">
                  <SelectValue placeholder={loadingStaff ? "로딩 중..." : "직원을 선택하세요"} />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pinCode">PIN 번호</Label>
              <Input
                id="pinCode"
                type="password"
                inputMode="numeric"
                placeholder="PIN 번호 (6자리)"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                PIN 번호 6자리를 입력하세요. PIN 미설정 시 생년월일(YYMMDD)로 로그인 가능합니다.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || loadingStaff || !selectedStaffId || !pinCode}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {loading ? '인증 중...' : '인증하기'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
