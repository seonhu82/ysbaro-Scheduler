'use client'

import { useState, useEffect } from 'react'
import { DateSelector } from '@/components/public-apply/DateSelector'
import { TypeSelector } from '@/components/public-apply/TypeSelector'
import { RealTimeStatus } from '@/components/public-apply/RealTimeStatus'
import FairnessCheck from '@/components/leave-apply/FairnessCheck'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatDateWithDay } from '@/lib/date-utils'
import { Calendar, Send, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type LeaveType = 'ANNUAL' | 'OFF'

interface SlotStatus {
  date: string
  available: number
  total: number
  isHoliday: boolean
}

interface AuthData {
  staffId: string
  staffName: string
  categoryName: string
  clinicId: string
}

export default function LeaveApplyPage({
  params,
}: {
  params: { token: string }
}) {
  const { toast } = useToast()
  const [isAuth, setIsAuth] = useState(false)
  const [authData, setAuthData] = useState<AuthData | null>(null)
  const [birthDate, setBirthDate] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  // 신청 폼 상태
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedType, setSelectedType] = useState<LeaveType>('ANNUAL')
  const [slotStatus, setSlotStatus] = useState<SlotStatus[]>([])
  const [weeklyOffCount, setWeeklyOffCount] = useState(0)

  // 확인 모달
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 인증 처리
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/leave-apply/${params.token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthDate,
          pin
        })
      })

      const result = await response.json()

      if (result.success) {
        setIsAuth(true)
        setAuthData(result.data)
        toast({
          title: '인증 성공',
          description: `${result.data.staffName}님, 연차/오프 신청이 가능합니다.`,
        })
      } else {
        throw new Error(result.error || '인증 실패')
      }
    } catch (error: any) {
      toast({
        title: '인증 실패',
        description: error.message || '생년월일 또는 PIN이 올바르지 않습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // 신청 제출
  const handleSubmit = async () => {
    if (!selectedDate) {
      toast({
        title: '날짜 선택 필요',
        description: '신청할 날짜를 선택해주세요.',
        variant: 'destructive',
      })
      return
    }

    setShowConfirm(true)
  }

  const confirmSubmit = async () => {
    setSubmitting(true)

    try {
      const response = await fetch(`/api/leave-apply/${params.token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate?.toISOString().split('T')[0],
          type: selectedType,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '신청 완료',
          description: '연차/오프 신청이 완료되었습니다.',
        })
        setShowConfirm(false)
        // 폼 초기화
        setSelectedDate(undefined)
      } else {
        throw new Error(result.error || '신청 실패')
      }
    } catch (error: any) {
      toast({
        title: '신청 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">연차/오프 신청</h1>
            <p className="text-gray-600">
              직원 인증이 필요합니다
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Label htmlFor="birthDate">생년월일</Label>
              <Input
                id="birthDate"
                type="text"
                placeholder="예: 19900101"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                maxLength={8}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                8자리 숫자 (YYYYMMDD)
              </p>
            </div>

            <div>
              <Label htmlFor="pin">PIN 번호</Label>
              <Input
                id="pin"
                type="password"
                placeholder="4자리 PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={4}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                4자리 숫자
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '인증 중...' : '인증하기'}
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">연차/오프 신청</h1>
        <p className="text-gray-600">
          {authData && `${authData.staffName}님, `}원하는 날짜와 유형을 선택해서 신청하세요
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 신청 폼 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 형평성 체크 */}
          {authData && selectedDate && (
            <FairnessCheck
              staffId={authData.staffId}
              startDate={selectedDate}
              endDate={selectedDate}
            />
          )}

          <DateSelector
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            slotStatus={slotStatus}
          />

          <TypeSelector
            selectedType={selectedType}
            onSelect={setSelectedType}
            weeklyOffCount={weeklyOffCount}
          />

          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!selectedDate}
          >
            <Send className="w-5 h-5 mr-2" />
            신청하기
          </Button>
        </div>

        {/* 오른쪽: 실시간 현황 */}
        <div className="lg:col-span-1">
          <RealTimeStatus token={params.token} selectedDate={selectedDate} />
        </div>
      </div>

      {/* 확인 모달 */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              신청 확인
            </DialogTitle>
            <DialogDescription>
              아래 내용으로 신청하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">날짜</span>
                <span className="font-medium">
                  {selectedDate && formatDateWithDay(selectedDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">유형</span>
                <span className="font-medium">
                  {selectedType === 'ANNUAL' ? '연차' : '오프'}
                </span>
              </div>
            </div>

            {selectedType === 'OFF' && weeklyOffCount > 0 && (
              <div className="text-sm text-gray-600">
                이번 주 오프 신청: {weeklyOffCount + 1}/2일
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button onClick={confirmSubmit} disabled={submitting}>
              {submitting ? '신청 중...' : '확인'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
