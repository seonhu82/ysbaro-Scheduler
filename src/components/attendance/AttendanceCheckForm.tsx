/**
 * 출퇴근 체크 폼 컴포넌트 (모바일용)
 *
 * 기능:
 * - 직원 선택
 * - 출근/퇴근 선택
 * - 디바이스 정보 자동 수집
 * - 제출 및 결과 표시
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
    setIsSubmitting(true)
    setMessage(null)

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
        setMessage({
          type: 'success',
          text: `${checkType === 'IN' ? '출근' : '퇴근'} 체크가 완료되었습니다.`
        })
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">직원 선택</label>
        <select
          value={selectedStaff}
          onChange={(e) => setSelectedStaff(e.target.value)}
          className="w-full border rounded-md p-2"
          required
        >
          <option value="">선택하세요</option>
          {staffList.map((staff) => (
            <option key={staff.id} value={staff.id}>
              {staff.name} ({staff.rank})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">구분</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setCheckType('IN')}
            className={`p-4 rounded-lg border-2 ${
              checkType === 'IN'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300'
            }`}
          >
            출근
          </button>
          <button
            type="button"
            onClick={() => setCheckType('OUT')}
            className={`p-4 rounded-lg border-2 ${
              checkType === 'OUT'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300'
            }`}
          >
            퇴근
          </button>
        </div>
      </div>

      {message && (
        <Card className={message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardContent className="pt-4">
            <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </p>
          </CardContent>
        </Card>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || !selectedStaff}
        className="w-full"
      >
        {isSubmitting ? '처리 중...' : checkType === 'IN' ? '출근 체크' : '퇴근 체크'}
      </Button>
    </form>
  )
}
