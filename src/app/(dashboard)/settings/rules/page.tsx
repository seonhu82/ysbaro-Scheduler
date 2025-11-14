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
  defaultAnnualDays: number
  maxWeeklyOffs: number
  preventSundayOff: boolean
  preventHolidayOff: boolean
  maxMonthlyOffApplications: number
  maxMonthlyAnnualApplications: number
}

export default function RulesSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<RuleSettings>({
    weekBusinessDays: 6,
    defaultWorkDays: 4,
    defaultAnnualDays: 15,
    maxWeeklyOffs: 2,
    preventSundayOff: true,
    preventHolidayOff: true,
    maxMonthlyOffApplications: 4,
    maxMonthlyAnnualApplications: 4
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

            <div>
              <Label htmlFor="defaultAnnualDays">연 기본 연차 일수</Label>
              <Input
                id="defaultAnnualDays"
                type="number"
                min="0"
                max="30"
                value={settings.defaultAnnualDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultAnnualDays: parseInt(e.target.value) || 15
                  })
                }
              />
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs font-semibold text-blue-900 mb-2">
                  📚 근로기준법 제60조 (연차 유급휴가)
                </p>
                <ul className="text-xs text-blue-800 space-y-1.5">
                  <li className="flex gap-2">
                    <span className="font-semibold min-w-[80px]">1년 미만:</span>
                    <span>1개월 개근 시 1일 (최대 11일)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold min-w-[80px]">1년 이상:</span>
                    <span>15일 (기본)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold min-w-[80px]">3년 이상:</span>
                    <span>매 2년마다 1일씩 가산 (최대 25일)</span>
                  </li>
                </ul>
                <p className="text-xs text-blue-700 mt-2 pt-2 border-t border-blue-200">
                  ⚠️ 위 설정값은 신규 직원 등록 시 입사일이 없는 경우에만 사용됩니다.
                  입사일을 입력하면 근속연수에 따라 자동으로 법정 연차가 계산됩니다.
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

        {/* 월별 신청 제한 */}
        <Card>
          <CardHeader>
            <CardTitle>월별 신청 제한</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxMonthlyOffApplications">월 최대 오프 신청수</Label>
                <Input
                  id="maxMonthlyOffApplications"
                  type="number"
                  min="0"
                  max="20"
                  value={settings.maxMonthlyOffApplications}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxMonthlyOffApplications: parseInt(e.target.value)
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  한 달에 신청 가능한 최대 오프 횟수
                </p>
              </div>

              <div>
                <Label htmlFor="maxMonthlyAnnualApplications">월 최대 연차 신청수</Label>
                <Input
                  id="maxMonthlyAnnualApplications"
                  type="number"
                  min="0"
                  max="20"
                  value={settings.maxMonthlyAnnualApplications}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxMonthlyAnnualApplications: parseInt(e.target.value)
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  한 달에 신청 가능한 최대 연차 횟수
                </p>
              </div>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-xs text-amber-800">
                💡 이 설정값은 직원이 연차/오프를 신청할 때 제한하는 데 사용됩니다.
                형평성을 맞추기 위해 월별 신청 가능 횟수를 제한할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
