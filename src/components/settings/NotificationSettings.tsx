'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Bell, Save } from 'lucide-react'

interface NotificationConfig {
  emailNotifications: boolean
  scheduleChangeNotifications: boolean
  leaveApplicationNotifications: boolean
  leaveApprovedNotifications: boolean
  leaveRejectedNotifications: boolean
  weeklyDigest: boolean
  monthlyReport: boolean
  fairnessAlerts: boolean
}

export function NotificationSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<NotificationConfig>({
    emailNotifications: true,
    scheduleChangeNotifications: true,
    leaveApplicationNotifications: true,
    leaveApprovedNotifications: true,
    leaveRejectedNotifications: true,
    weeklyDigest: false,
    monthlyReport: true,
    fairnessAlerts: true
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/notifications')
      const result = await response.json()
      if (result.success) {
        setConfig(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch notification config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const result = await response.json()

      if (result.success) {
        alert('알림 설정이 저장되었습니다')
      } else {
        alert(result.error || '저장에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to save notification config:', error)
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
            <Bell className="w-6 h-6" />
            알림 설정
          </h2>
          <p className="text-gray-600 mt-1">
            이메일 및 시스템 알림 설정을 관리합니다
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 기본 알림 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>기본 알림 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>이메일 알림</Label>
                <p className="text-sm text-gray-500">
                  이메일로 알림을 받습니다
                </p>
              </div>
              <Switch
                checked={config.emailNotifications}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, emailNotifications: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* 스케줄 관련 알림 */}
        <Card>
          <CardHeader>
            <CardTitle>스케줄 관련 알림</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>스케줄 변경 알림</Label>
                <p className="text-sm text-gray-500">
                  스케줄이 변경되면 알림을 받습니다
                </p>
              </div>
              <Switch
                checked={config.scheduleChangeNotifications}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, scheduleChangeNotifications: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>형평성 경고</Label>
                <p className="text-sm text-gray-500">
                  형평성 점수가 낮을 때 경고를 받습니다
                </p>
              </div>
              <Switch
                checked={config.fairnessAlerts}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, fairnessAlerts: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* 연차 관련 알림 */}
        <Card>
          <CardHeader>
            <CardTitle>연차 관련 알림</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>연차 신청 알림</Label>
                <p className="text-sm text-gray-500">
                  직원이 연차를 신청하면 알림을 받습니다
                </p>
              </div>
              <Switch
                checked={config.leaveApplicationNotifications}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    leaveApplicationNotifications: checked
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>연차 승인 알림</Label>
                <p className="text-sm text-gray-500">
                  연차가 승인되면 직원에게 알림을 보냅니다
                </p>
              </div>
              <Switch
                checked={config.leaveApprovedNotifications}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, leaveApprovedNotifications: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>연차 거부 알림</Label>
                <p className="text-sm text-gray-500">
                  연차가 거부되면 직원에게 알림을 보냅니다
                </p>
              </div>
              <Switch
                checked={config.leaveRejectedNotifications}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, leaveRejectedNotifications: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* 정기 리포트 */}
        <Card>
          <CardHeader>
            <CardTitle>정기 리포트</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>주간 요약</Label>
                <p className="text-sm text-gray-500">
                  매주 스케줄 요약을 이메일로 받습니다
                </p>
              </div>
              <Switch
                checked={config.weeklyDigest}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, weeklyDigest: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>월간 리포트</Label>
                <p className="text-sm text-gray-500">
                  매월 통계 리포트를 이메일로 받습니다
                </p>
              </div>
              <Switch
                checked={config.monthlyReport}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, monthlyReport: checked })
                }
              />
            </div>
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
