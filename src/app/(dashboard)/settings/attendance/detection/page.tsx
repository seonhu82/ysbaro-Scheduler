/**
 * 의심 패턴 감지 설정 페이지
 * 경로: /settings/attendance/detection
 *
 * 기능:
 * - 지각 기준 시간 설정
 * - 의심스러운 출퇴근 패턴 감지 규칙
 * - 알림 설정
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, Save, RefreshCw, Clock, Bell } from 'lucide-react'

interface DetectionSettings {
  lateThresholdMinutes: number
  earlyLeaveThresholdMinutes: number
  repeatCheckThresholdMinutes: number
  detectUnscheduledCheckIn: boolean
  consecutiveLateThreshold: number
  consecutiveEarlyLeaveThreshold: number
  enableNotifications: boolean
}

export default function DetectionSettingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState<DetectionSettings>({
    lateThresholdMinutes: 10,
    earlyLeaveThresholdMinutes: 10,
    repeatCheckThresholdMinutes: 5,
    detectUnscheduledCheckIn: true,
    consecutiveLateThreshold: 3,
    consecutiveEarlyLeaveThreshold: 3,
    enableNotifications: true
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/attendance/detection-settings')
      const data = await response.json()

      if (data.success) {
        setSettings(data.data.settings)
      } else {
        toast({
          variant: 'destructive',
          title: '설정 로드 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '설정을 불러오는 중 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const response = await fetch('/api/attendance/detection-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '저장 완료',
          description: '의심 패턴 감지 설정이 저장되었습니다'
        })
        await fetchSettings()
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
        description: '설정 저장 중 오류가 발생했습니다'
      })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof DetectionSettings>(
    key: K,
    value: DetectionSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">로딩 중...</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/settings/attendance')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          돌아가기
        </Button>
        <h1 className="text-2xl font-bold mb-2">의심 패턴 감지 설정</h1>
        <p className="text-gray-600">
          지각 기준과 의심스러운 출퇴근 패턴을 감지합니다
        </p>
      </div>

      <div className="mb-4 p-4 bg-amber-50 rounded-lg text-sm text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <strong>안내:</strong> 이 설정은 출퇴근 기록을 분석하여 의심스러운 패턴을 감지하는데 사용됩니다.
            설정값을 변경하면 즉시 적용되며, 모든 출퇴근 체크에 영향을 미칩니다.
          </div>
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* 지각/조퇴 기준 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              지각/조퇴 기준 설정
            </CardTitle>
            <CardDescription>
              지각과 조퇴를 판단하는 기준 시간을 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lateThreshold">지각 허용 시간 (분)</Label>
                <Input
                  id="lateThreshold"
                  type="number"
                  min="0"
                  max="120"
                  value={settings.lateThresholdMinutes}
                  onChange={(e) => updateSetting('lateThresholdMinutes', parseInt(e.target.value) || 0)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  출근 시간 +{settings.lateThresholdMinutes}분까지 허용
                </p>
              </div>

              <div>
                <Label htmlFor="earlyLeaveThreshold">조퇴 기준 시간 (분)</Label>
                <Input
                  id="earlyLeaveThreshold"
                  type="number"
                  min="0"
                  max="120"
                  value={settings.earlyLeaveThresholdMinutes}
                  onChange={(e) => updateSetting('earlyLeaveThresholdMinutes', parseInt(e.target.value) || 0)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  퇴근 시간 -{settings.earlyLeaveThresholdMinutes}분 전에 퇴근 시 조퇴로 간주
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 의심 패턴 감지 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              의심 패턴 감지 설정
            </CardTitle>
            <CardDescription>
              의심스러운 출퇴근 패턴을 감지하는 규칙을 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="repeatCheckThreshold">반복 출퇴근 감지 시간 (분)</Label>
              <Input
                id="repeatCheckThreshold"
                type="number"
                min="0"
                max="60"
                value={settings.repeatCheckThresholdMinutes}
                onChange={(e) => updateSetting('repeatCheckThresholdMinutes', parseInt(e.target.value) || 0)}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                {settings.repeatCheckThresholdMinutes}분 내에 동일 직원이 다시 출퇴근하면 의심 패턴으로 간주
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="detectUnscheduled" className="text-base font-medium cursor-pointer">
                  스케줄 외 출근 감지
                </Label>
                <p className="text-sm text-gray-500 mt-1">
                  스케줄에 없는 직원의 출근을 의심 패턴으로 표시
                </p>
              </div>
              <Switch
                id="detectUnscheduled"
                checked={settings.detectUnscheduledCheckIn}
                onCheckedChange={(checked) => updateSetting('detectUnscheduledCheckIn', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 연속 지각/조퇴 알림 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              연속 지각/조퇴 알림 설정
            </CardTitle>
            <CardDescription>
              연속으로 지각 또는 조퇴한 경우 알림을 받을 기준을 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="consecutiveLate">연속 지각 알림 기준 (일)</Label>
                <Input
                  id="consecutiveLate"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.consecutiveLateThreshold}
                  onChange={(e) => updateSetting('consecutiveLateThreshold', parseInt(e.target.value) || 1)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {settings.consecutiveLateThreshold}일 연속 지각 시 알림
                </p>
              </div>

              <div>
                <Label htmlFor="consecutiveEarlyLeave">연속 조퇴 알림 기준 (일)</Label>
                <Input
                  id="consecutiveEarlyLeave"
                  type="number"
                  min="1"
                  max="30"
                  value={settings.consecutiveEarlyLeaveThreshold}
                  onChange={(e) => updateSetting('consecutiveEarlyLeaveThreshold', parseInt(e.target.value) || 1)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {settings.consecutiveEarlyLeaveThreshold}일 연속 조퇴 시 알림
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <Label htmlFor="enableNotifications" className="text-base font-medium cursor-pointer">
                  알림 활성화
                </Label>
                <p className="text-sm text-gray-500 mt-1">
                  의심 패턴 감지 시 알림 받기
                </p>
              </div>
              <Switch
                id="enableNotifications"
                checked={settings.enableNotifications}
                onCheckedChange={(checked) => updateSetting('enableNotifications', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 mt-6 max-w-3xl">
        <Button variant="outline" onClick={fetchSettings} disabled={saving}>
          <RefreshCw className="w-4 h-4 mr-2" />
          초기화
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  )
}
