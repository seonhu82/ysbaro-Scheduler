/**
 * 근무 규칙 설정 페이지
 * 경로: /settings/rules
 *
 * 기능:
 * - 주 영업일 및 근무일 설정
 * - 오프 관련 규칙 설정
 * - 근무 관련 규칙 설정
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Settings, Save, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface RuleSettings {
  weekBusinessDays: number
  defaultWorkDays: number
  maxWeeklyOffs: number
  preventSundayOff: boolean
  preventHolidayOff: boolean
  maxConsecutiveNights: number
  minRestAfterNight: number
}

export default function RulesSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<RuleSettings>({
    weekBusinessDays: 6,
    defaultWorkDays: 4,
    maxWeeklyOffs: 2,
    preventSundayOff: true,
    preventHolidayOff: true,
    maxConsecutiveNights: 3,
    minRestAfterNight: 1
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/rules')
      const data = await response.json()

      if (data.success) {
        setSettings(data.data || settings)
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/settings/rules', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '저장 완료',
          description: '근무 규칙이 저장되었습니다'
        })
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-500" />
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Settings className="w-7 h-7" />
            근무 규칙
          </h1>
          <p className="text-gray-600">
            직원 근무와 관련된 기본 규칙을 설정합니다
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>

      <div className="space-y-6">
        {/* 기본 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>기본 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weekBusinessDays">주 영업일 (1~7)</Label>
                <Input
                  id="weekBusinessDays"
                  type="number"
                  min="1"
                  max="7"
                  value={settings.weekBusinessDays}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      weekBusinessDays: parseInt(e.target.value)
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  병원의 주당 영업 일수
                </p>
              </div>

              <div>
                <Label htmlFor="defaultWorkDays">신규 직원 기본 근무일</Label>
                <Input
                  id="defaultWorkDays"
                  type="number"
                  min="1"
                  max="7"
                  value={settings.defaultWorkDays}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultWorkDays: parseInt(e.target.value)
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  신규 직원 등록 시 기본 근무일수
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 오프 관련 규칙 */}
        <Card>
          <CardHeader>
            <CardTitle>오프 관련 규칙</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="maxWeeklyOffs">주 최대 오프 횟수</Label>
              <Input
                id="maxWeeklyOffs"
                type="number"
                min="0"
                max="7"
                value={settings.maxWeeklyOffs}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxWeeklyOffs: parseInt(e.target.value)
                  })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                한 주에 허용되는 최대 오프 횟수
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>일요일 오프 방지</Label>
                <p className="text-xs text-gray-500 mt-1">
                  일요일에 오프를 허용하지 않음
                </p>
              </div>
              <Switch
                checked={settings.preventSundayOff}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, preventSundayOff: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>공휴일 오프 방지</Label>
                <p className="text-xs text-gray-500 mt-1">
                  공휴일에 오프를 허용하지 않음
                </p>
              </div>
              <Switch
                checked={settings.preventHolidayOff}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, preventHolidayOff: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* 근무 관련 규칙 */}
        <Card>
          <CardHeader>
            <CardTitle>근무 관련 규칙</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxConsecutiveNights">최대 연속 야간 근무</Label>
                <Input
                  id="maxConsecutiveNights"
                  type="number"
                  min="1"
                  max="7"
                  value={settings.maxConsecutiveNights}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxConsecutiveNights: parseInt(e.target.value)
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  연속으로 허용되는 최대 야간 근무 일수
                </p>
              </div>

              <div>
                <Label htmlFor="minRestAfterNight">야간 후 최소 휴식일</Label>
                <Input
                  id="minRestAfterNight"
                  type="number"
                  min="0"
                  max="7"
                  value={settings.minRestAfterNight}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minRestAfterNight: parseInt(e.target.value)
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  야간 근무 후 필요한 최소 휴식 일수
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
