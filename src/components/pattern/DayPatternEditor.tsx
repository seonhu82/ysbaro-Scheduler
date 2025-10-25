'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Save, Calendar } from 'lucide-react'

interface DayPattern {
  dayOfWeek: number
  isWorkday: boolean
  hasNightShift: boolean
}

interface DayPatternEditorProps {
  doctorId: string
  patternName?: string
  initialPattern?: DayPattern[]
  onSave?: (pattern: { patternName: string; days: DayPattern[] }) => Promise<void>
}

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

export function DayPatternEditor({
  doctorId,
  patternName: initialPatternName = '',
  initialPattern,
  onSave
}: DayPatternEditorProps) {
  const [patternName, setPatternName] = useState(initialPatternName)
  const [pattern, setPattern] = useState<DayPattern[]>(
    initialPattern || DAY_NAMES.map((_, index) => ({
      dayOfWeek: index,
      isWorkday: index !== 0, // 일요일 제외
      hasNightShift: false
    }))
  )
  const [saving, setSaving] = useState(false)

  const handleToggleWorkday = (dayOfWeek: number) => {
    setPattern((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? { ...day, isWorkday: !day.isWorkday }
          : day
      )
    )
  }

  const handleToggleNightShift = (dayOfWeek: number) => {
    setPattern((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? { ...day, hasNightShift: !day.hasNightShift }
          : day
      )
    )
  }

  const handleSave = async () => {
    if (!patternName.trim()) {
      alert('패턴 이름을 입력하세요')
      return
    }

    setSaving(true)
    try {
      if (onSave) {
        await onSave({ patternName, days: pattern })
      } else {
        // 기본 API 호출
        const response = await fetch('/api/settings/doctors/patterns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctorId,
            patternName,
            days: pattern
          })
        })

        if (!response.ok) {
          throw new Error('Failed to save pattern')
        }

        alert('패턴이 저장되었습니다')
      }
    } catch (error) {
      console.error('Save pattern error:', error)
      alert('패턴 저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          요일별 근무 패턴 설정
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 패턴 이름 */}
        <div>
          <Label htmlFor="patternName">패턴 이름</Label>
          <Input
            id="patternName"
            value={patternName}
            onChange={(e) => setPatternName(e.target.value)}
            placeholder="예: 기본 패턴, 여름 패턴"
          />
        </div>

        {/* 요일별 설정 */}
        <div className="space-y-3">
          <Label>요일별 근무 설정</Label>
          {pattern.map((day) => (
            <div
              key={day.dayOfWeek}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-4 flex-1">
                <span className="font-medium w-20">
                  {DAY_NAMES[day.dayOfWeek]}
                </span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={day.isWorkday}
                    onCheckedChange={() => handleToggleWorkday(day.dayOfWeek)}
                  />
                  <span className="text-sm">
                    {day.isWorkday ? '근무일' : '휴무일'}
                  </span>
                </div>
              </div>

              {day.isWorkday && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={day.hasNightShift}
                    onCheckedChange={() => handleToggleNightShift(day.dayOfWeek)}
                  />
                  <span className="text-sm">야간 진료</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 저장 버튼 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? '저장 중...' : '패턴 저장'}
          </Button>
        </div>

        {/* 패턴 요약 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 mb-2">패턴 요약</p>
          <div className="text-sm text-blue-800 space-y-1">
            <p>
              근무일: {pattern.filter((d) => d.isWorkday).length}일
            </p>
            <p>
              야간 진료: {pattern.filter((d) => d.hasNightShift).length}일
            </p>
            <p className="text-xs text-blue-600 mt-2">
              {pattern
                .filter((d) => d.isWorkday)
                .map((d) => DAY_NAMES[d.dayOfWeek])
                .join(', ')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
