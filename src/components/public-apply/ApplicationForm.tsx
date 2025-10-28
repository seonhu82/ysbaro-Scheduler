'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Calendar, User, MessageSquare } from 'lucide-react'
import { DateSelector } from './DateSelector'
import { TypeSelector } from './TypeSelector'
import { RealTimeStatus } from './RealTimeStatus'
import { FormField, TextInput, Textarea as AccessibleTextarea } from '@/components/ui/form-field'
import { LeaveTypeBadge } from '@/components/ui/status-badge'
import { announceToScreenReader } from '@/lib/utils/accessibility'
import { SkeletonCard, SkeletonText } from '@/components/ui/skeleton'

type LeaveType = 'ANNUAL' | 'OFF'

interface SlotStatus {
  date: string
  available: number
  total: number
  isHoliday: boolean
}

interface ApplicationFormProps {
  token: string
  staffName?: string
  onSubmit: (data: ApplicationData) => void
  onCancel?: () => void
}

export interface ApplicationData {
  date: Date
  leaveType: LeaveType
  reason: string
  emergencyContact?: string
}

export function ApplicationForm({
  token,
  staffName,
  onSubmit,
  onCancel
}: ApplicationFormProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [leaveType, setLeaveType] = useState<LeaveType>('ANNUAL')
  const [reason, setReason] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [slotStatus, setSlotStatus] = useState<SlotStatus[]>([])
  const [weeklyOffCount, setWeeklyOffCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<{ reason?: string; contact?: string }>({}) // 🆕 필드별 에러

  useEffect(() => {
    fetchSlotStatus()
  }, [token])

  useEffect(() => {
    if (selectedDate) {
      fetchWeeklyOffCount(selectedDate)
    }
  }, [selectedDate, token])

  const fetchSlotStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leave-apply/${token}/status`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSlotStatus(data.data.slots || [])
        }
      }
    } catch (error) {
      console.error('Failed to fetch slot status:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWeeklyOffCount = async (date: Date) => {
    try {
      const dateStr = date.toISOString().split('T')[0]
      const response = await fetch(
        `/api/leave-apply/${token}/status?date=${dateStr}&type=weekly-off`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setWeeklyOffCount(data.data.weeklyOffCount || 0)
        }
      }
    } catch (error) {
      console.error('Failed to fetch weekly off count:', error)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: string[] = []
    const newFieldErrors: { reason?: string; contact?: string } = {}

    if (!selectedDate) {
      newErrors.push('날짜를 선택해주세요')
    }

    if (!reason.trim()) {
      newFieldErrors.reason = '사유를 입력해주세요'
      newErrors.push('사유를 입력해주세요')
    } else if (reason.trim().length < 5) {
      newFieldErrors.reason = '사유는 최소 5자 이상 입력해주세요'
      newErrors.push('사유는 최소 5자 이상 입력해주세요')
    }

    // 🆕 비상 연락처 검증 (선택 필드지만 입력 시 형식 체크)
    if (emergencyContact.trim() && !/^[0-9-+().\s]+$/.test(emergencyContact)) {
      newFieldErrors.contact = '올바른 전화번호 형식을 입력해주세요'
      newErrors.push('올바른 전화번호 형식을 입력해주세요')
    }

    if (leaveType === 'OFF' && weeklyOffCount >= 2) {
      newErrors.push('이번 주는 이미 2일의 오프를 신청하셨습니다')
    }

    setErrors(newErrors)
    setFieldErrors(newFieldErrors)

    if (newErrors.length > 0) {
      announceToScreenReader('입력 정보를 확인해주세요', 'assertive')
    }

    return newErrors.length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    if (!selectedDate) return

    try {
      setSubmitting(true)

      const applicationData: ApplicationData = {
        date: selectedDate,
        leaveType,
        reason: reason.trim(),
        emergencyContact: emergencyContact.trim() || undefined
      }

      onSubmit(applicationData)
    } catch (error) {
      console.error('Failed to submit:', error)
      setErrors(['신청 중 오류가 발생했습니다. 다시 시도해주세요.'])
    } finally {
      setSubmitting(false)
    }
  }

  // 🆕 스켈레톤 로딩 스크린
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="mb-6 space-y-2">
          <div className="h-9 w-48 bg-gray-200 animate-pulse rounded" />
          <div className="h-5 w-32 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="lg:col-span-1">
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">연차/오프 신청</h1>
        {staffName && (
          <div className="flex items-center gap-2 text-gray-600">
            <User className="w-4 h-4" />
            <span>{staffName}님의 신청서</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 신청 폼 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 날짜 선택 */}
          <DateSelector
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            slotStatus={slotStatus}
          />

          {/* 유형 선택 */}
          <TypeSelector
            selectedType={leaveType}
            onSelect={setLeaveType}
            weeklyOffCount={weeklyOffCount}
          />

          {/* 🆕 사유 입력 - 접근성 개선 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                사유
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 신청 사유 */}
              <FormField
                id="reason"
                label="신청 사유"
                required
                error={fieldErrors.reason}
                helperText={`${reason.length}/200자`}
              >
                <AccessibleTextarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setFieldErrors({ ...fieldErrors, reason: undefined })
                  }}
                  placeholder="연차/오프 신청 사유를 입력해주세요 (최소 5자 이상)"
                  rows={4}
                  maxLength={200}
                  error={!!fieldErrors.reason}
                />
              </FormField>

              {/* 비상 연락처 */}
              <FormField
                id="emergency-contact"
                label="비상 연락처"
                error={fieldErrors.contact}
                helperText="연차 기간 중 연락 가능한 번호를 입력해주세요"
              >
                <TextInput
                  type="tel"
                  value={emergencyContact}
                  onChange={(e) => {
                    setEmergencyContact(e.target.value)
                    setFieldErrors({ ...fieldErrors, contact: undefined })
                  }}
                  placeholder="010-1234-5678"
                  error={!!fieldErrors.contact}
                />
              </FormField>
            </CardContent>
          </Card>

          {/* 오류 메시지 */}
          {errors.length > 0 && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-2">
                      신청할 수 없습니다
                    </h3>
                    <ul className="space-y-1">
                      {errors.map((error, index) => (
                        <li key={index} className="text-sm text-red-800">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 신청 요약 */}
          {selectedDate && reason.trim().length >= 5 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">신청 요약</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">신청 날짜</span>
                  <span className="font-semibold">
                    {selectedDate.toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short'
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">유형</span>
                  <Badge variant={leaveType === 'ANNUAL' ? 'default' : 'secondary'}>
                    {leaveType === 'ANNUAL' ? '연차' : '오프'}
                  </Badge>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-gray-700">사유</span>
                  <span className="text-right text-sm max-w-xs">
                    {reason.substring(0, 50)}
                    {reason.length > 50 && '...'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-3">
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
              >
                취소
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedDate || !reason.trim()}
              className="min-w-32"
            >
              {submitting ? '신청 중...' : '신청하기'}
            </Button>
          </div>
        </div>

        {/* 오른쪽: 실시간 현황 */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <RealTimeStatus token={token} selectedDate={selectedDate} />
          </div>
        </div>
      </div>
    </div>
  )
}
