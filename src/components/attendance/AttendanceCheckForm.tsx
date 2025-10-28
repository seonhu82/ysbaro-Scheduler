/**
 * 출퇴근 체크 폼 컴포넌트 (모바일용)
 *
 * 기능:
 * - 직원 선택
 * - 출근/퇴근 선택
 * - 디바이스 정보 자동 수집
 * - 제출 및 결과 표시
 *
 * 🆕 접근성 개선:
 * - ARIA 레이블 추가
 * - 인라인 에러 메시지
 * - 키보드 네비게이션 지원
 * - 터치 타겟 44px 이상
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormField, Select, RadioGroup } from '@/components/ui/form-field'
import { StatusBadge } from '@/components/ui/status-badge'
import { announceToScreenReader } from '@/lib/utils/accessibility'

interface Staff {
  id: string
  name: string
  rank: string
}

export function AttendanceCheckForm({ token }: { token: string }) {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  const [checkType, setCheckType] = useState<'IN' | 'OUT'>('IN')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deviceInfo, setDeviceInfo] = useState<string>('')
  const [errors, setErrors] = useState<{ staff?: string }>({}) // 🆕 필드별 에러

  useEffect(() => {
    // 직원 목록 불러오기
    fetchStaffList()
    // 디바이스 정보 수집
    collectDeviceInfo()
  }, [])

  const fetchStaffList = async () => {
    try {
      const response = await fetch(`/api/attendance/staff-list?token=${token}`)
      const result = await response.json()
      if (result.success) {
        setStaffList(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch staff list:', error)
    }
  }

  const collectDeviceInfo = () => {
    // 간단한 디바이스 핑거프린트 생성
    const info = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
    setDeviceInfo(JSON.stringify(info))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 🆕 클라이언트 검증
    const newErrors: { staff?: string } = {}
    if (!selectedStaff) {
      newErrors.staff = '직원을 선택해주세요'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      announceToScreenReader('입력 정보를 확인해주세요', 'assertive')
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    setErrors({})

    try {
      const response = await fetch('/api/attendance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          staffId: selectedStaff,
          checkType,
          deviceInfo,
          timestamp: new Date().toISOString()
        })
      })

      const result = await response.json()

      if (result.success) {
        const successMessage = `${checkType === 'IN' ? '출근' : '퇴근'} 체크가 완료되었습니다.`
        setMessage({
          type: 'success',
          text: successMessage
        })
        // 🆕 스크린 리더 알림
        announceToScreenReader(successMessage, 'polite')
        setSelectedStaff('')
      } else {
        setMessage({
          type: 'error',
          text: result.error || '체크에 실패했습니다.'
        })
      }
    } catch (error) {
      console.error('Attendance check error:', error)
      setMessage({
        type: 'error',
        text: '오류가 발생했습니다. 다시 시도해주세요.'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="출퇴근 체크 폼">
      {/* 🆕 직원 선택 - 접근성 개선 */}
      <FormField
        id="staff-select"
        label="직원 선택"
        required
        error={errors.staff}
      >
        <Select
          value={selectedStaff}
          onChange={(e) => {
            setSelectedStaff(e.target.value)
            setErrors({})
          }}
          error={!!errors.staff}
        >
          <option value="">선택하세요</option>
          {staffList.map((staff) => (
            <option key={staff.id} value={staff.id}>
              {staff.name} ({staff.rank})
            </option>
          ))}
        </Select>
      </FormField>

      {/* 🆕 출퇴근 구분 - 라디오 그룹으로 개선 */}
      <RadioGroup
        id="check-type"
        label="구분"
        required
        options={[
          { value: 'IN', label: '출근' },
          { value: 'OUT', label: '퇴근' }
        ]}
        value={checkType}
        onChange={(value) => setCheckType(value as 'IN' | 'OUT')}
      />

      {/* 🆕 상태 메시지 - StatusBadge 사용 */}
      {message && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 rounded-lg border-2"
        >
          <StatusBadge
            status={message.type === 'success' ? 'success' : 'error'}
            size="md"
            className="mb-2"
          >
            {message.type === 'success' ? '완료' : '실패'}
          </StatusBadge>
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </p>
        </div>
      )}

      {/* 제출 버튼 */}
      <Button
        type="submit"
        disabled={isSubmitting || !selectedStaff}
        className="w-full"
        aria-label={isSubmitting ? '처리 중' : `${checkType === 'IN' ? '출근' : '퇴근'} 체크 제출`}
      >
        {isSubmitting ? '처리 중...' : checkType === 'IN' ? '출근 체크' : '퇴근 체크'}
      </Button>
    </form>
  )
}
