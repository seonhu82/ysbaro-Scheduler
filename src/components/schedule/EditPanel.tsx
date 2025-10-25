'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Save, X, AlertCircle } from 'lucide-react'
import { DoctorSelector } from './DoctorSelector'
import { StaffAssignment } from './StaffAssignment'
import { ValidationResult } from './ValidationResult'

interface EditPanelProps {
  scheduleId: string
  date: Date
  initialDoctors?: string[]
  initialStaff?: string[]
  onSave: (data: ScheduleData) => Promise<void>
  onCancel: () => void
}

interface ScheduleData {
  doctors: string[]
  staff: string[]
  hasNightShift: boolean
}

export function EditPanel({
  scheduleId,
  date,
  initialDoctors = [],
  initialStaff = [],
  onSave,
  onCancel
}: EditPanelProps) {
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>(initialDoctors)
  const [selectedStaff, setSelectedStaff] = useState<string[]>(initialStaff)
  const [hasNightShift, setHasNightShift] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const handleValidate = () => {
    const errors: string[] = []

    // 원장 검증
    if (selectedDoctors.length === 0) {
      errors.push('최소 1명의 원장을 선택해야 합니다')
    }

    // 직원 검증 (원장 1명당 2명의 스태프 필요)
    const requiredStaff = selectedDoctors.length * 2
    if (selectedStaff.length < requiredStaff) {
      errors.push(
        `원장 ${selectedDoctors.length}명에게 필요한 직원은 ${requiredStaff}명입니다 (현재: ${selectedStaff.length}명)`
      )
    }

    setValidationErrors(errors)
    return errors.length === 0
  }

  const handleSave = async () => {
    if (!handleValidate()) {
      return
    }

    try {
      setSaving(true)
      await onSave({
        doctors: selectedDoctors,
        staff: selectedStaff,
        hasNightShift
      })
    } catch (error) {
      console.error('Save failed:', error)
      alert('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

  const dayOfWeek = date.getDay()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6" />
          <div>
            <h2 className="text-2xl font-bold">{formatDate(date)}</h2>
            <div className="flex items-center gap-2 mt-1">
              {isWeekend && <Badge variant="secondary">주말</Badge>}
              {hasNightShift && <Badge variant="outline">야간진료</Badge>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {/* 검증 결과 */}
      {validationErrors.length > 0 && (
        <ValidationResult errors={validationErrors} warnings={[]} />
      )}

      {/* 야간 진료 토글 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">야간 진료</h3>
              <p className="text-sm text-gray-600">이 날 야간 진료가 있습니까?</p>
            </div>
            <input
              type="checkbox"
              checked={hasNightShift}
              onChange={(e) => setHasNightShift(e.target.checked)}
              className="w-5 h-5"
            />
          </div>
        </CardContent>
      </Card>

      {/* 원장 선택 */}
      <Card>
        <CardHeader>
          <CardTitle>원장 선택</CardTitle>
        </CardHeader>
        <CardContent>
          <DoctorSelector
            selectedDoctors={selectedDoctors}
            onSelectionChange={setSelectedDoctors}
            date={date}
          />
        </CardContent>
      </Card>

      {/* 직원 배치 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>직원 배치</span>
            <span className="text-sm font-normal text-gray-600">
              필요 인원: {selectedDoctors.length * 2}명 / 선택: {selectedStaff.length}명
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StaffAssignment
            selectedStaff={selectedStaff}
            onSelectionChange={setSelectedStaff}
            requiredCount={selectedDoctors.length * 2}
            date={date}
            isWeekend={isWeekend}
            hasNightShift={hasNightShift}
          />
        </CardContent>
      </Card>

      {/* 요약 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-2">배치 요약</p>
              <ul className="space-y-1">
                <li>• 원장: {selectedDoctors.length}명</li>
                <li>• 직원: {selectedStaff.length}명</li>
                <li>• 야간 진료: {hasNightShift ? '있음' : '없음'}</li>
                {isWeekend && <li>• 주말 근무</li>}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
