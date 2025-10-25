'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Save, AlertCircle } from 'lucide-react'

interface RuleData {
  weekBusinessDays: number
  week4WorkDays: number
  week4OffDays: number
  week5WorkDays: number
  week5OffDays: number
  maxConsecutiveWorkDays: number
  maxWeeklyOffs: number
}

export function RuleSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState<RuleData>({
    weekBusinessDays: 6,
    week4WorkDays: 4,
    week4OffDays: 2,
    week5WorkDays: 5,
    week5OffDays: 1,
    maxConsecutiveWorkDays: 5,
    maxWeeklyOffs: 2
  })

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/work-type')
      const result = await response.json()
      if (result.success) {
        setRules(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // 검증
    if (rules.week4WorkDays + rules.week4OffDays !== rules.weekBusinessDays) {
      alert('주4일 근무일 + 휴무일은 주 영업일수와 같아야 합니다')
      return
    }

    if (rules.week5WorkDays + rules.week5OffDays !== rules.weekBusinessDays) {
      alert('주5일 근무일 + 휴무일은 주 영업일수와 같아야 합니다')
      return
    }

    try {
      setSaving(true)
      const response = await fetch('/api/settings/work-type', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rules)
      })

      const result = await response.json()

      if (result.success) {
        alert('규칙이 저장되었습니다')
      } else {
        alert(result.error || '저장에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to save rules:', error)
      alert('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-center py-8">로딩 중...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            근무 규칙 설정
          </h2>
          <p className="text-gray-600 mt-1">근무 형태 및 제약 조건을 설정합니다</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 기본 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>기본 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="weekBusinessDays">주 영업일수</Label>
              <Input
                id="weekBusinessDays"
                type="number"
                min={1}
                max={7}
                value={rules.weekBusinessDays}
                onChange={(e) =>
                  setRules({ ...rules, weekBusinessDays: parseInt(e.target.value) })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                일주일 중 병원이 운영되는 날 (보통 6일: 월~토)
              </p>
            </div>

            <div>
              <Label htmlFor="maxConsecutiveWorkDays">최대 연속 근무일</Label>
              <Input
                id="maxConsecutiveWorkDays"
                type="number"
                min={1}
                max={10}
                value={rules.maxConsecutiveWorkDays}
                onChange={(e) =>
                  setRules({
                    ...rules,
                    maxConsecutiveWorkDays: parseInt(e.target.value)
                  })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                직원이 연속으로 근무할 수 있는 최대 일수
              </p>
            </div>

            <div>
              <Label htmlFor="maxWeeklyOffs">주당 최대 오프 수</Label>
              <Input
                id="maxWeeklyOffs"
                type="number"
                min={1}
                max={4}
                value={rules.maxWeeklyOffs}
                onChange={(e) =>
                  setRules({ ...rules, maxWeeklyOffs: parseInt(e.target.value) })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                한 주에 받을 수 있는 최대 오프 일수
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 주4일 근무 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>주4일 근무 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="week4WorkDays">근무일</Label>
                <Input
                  id="week4WorkDays"
                  type="number"
                  min={1}
                  max={6}
                  value={rules.week4WorkDays}
                  onChange={(e) =>
                    setRules({ ...rules, week4WorkDays: parseInt(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor="week4OffDays">휴무일</Label>
                <Input
                  id="week4OffDays"
                  type="number"
                  min={1}
                  max={6}
                  value={rules.week4OffDays}
                  onChange={(e) =>
                    setRules({ ...rules, week4OffDays: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
            {rules.week4WorkDays + rules.week4OffDays !== rules.weekBusinessDays && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                근무일 + 휴무일 = 주 영업일수({rules.weekBusinessDays})가 되어야 합니다
              </div>
            )}
          </CardContent>
        </Card>

        {/* 주5일 근무 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>주5일 근무 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="week5WorkDays">근무일</Label>
                <Input
                  id="week5WorkDays"
                  type="number"
                  min={1}
                  max={6}
                  value={rules.week5WorkDays}
                  onChange={(e) =>
                    setRules({ ...rules, week5WorkDays: parseInt(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor="week5OffDays">휴무일</Label>
                <Input
                  id="week5OffDays"
                  type="number"
                  min={1}
                  max={6}
                  value={rules.week5OffDays}
                  onChange={(e) =>
                    setRules({ ...rules, week5OffDays: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
            {rules.week5WorkDays + rules.week5OffDays !== rules.weekBusinessDays && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                근무일 + 휴무일 = 주 영업일수({rules.weekBusinessDays})가 되어야 합니다
              </div>
            )}
          </CardContent>
        </Card>

        {/* 저장 버튼 */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {saving ? '저장 중...' : '설정 저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
