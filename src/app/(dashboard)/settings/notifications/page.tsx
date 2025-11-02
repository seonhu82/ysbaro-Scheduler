/**
 * 알림 설정 페이지
 * 이메일, Slack, 웹훅 등 알림 채널 설정
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Bell, Mail, MessageSquare, Webhook, Save, RefreshCw } from 'lucide-react'

interface NotificationSettings {
  email: {
    enabled: boolean
    smtpHost: string
    smtpPort: number
    smtpUser: string
    smtpPassword: string
    fromEmail: string
    fromName: string
  }
  slack: {
    enabled: boolean
    webhookUrl: string
    channel: string
  }
  webhook: {
    enabled: boolean
    url: string
    secret: string
  }
  notifications: {
    leaveApplicationSubmitted: boolean
    leaveApplicationApproved: boolean
    leaveApplicationRejected: boolean
    scheduleDeployed: boolean
    fairnessAlert: boolean
    attendanceAnomaly: boolean
  }
}

export default function NotificationsSettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      enabled: false,
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      fromEmail: '',
      fromName: '연세바로치과'
    },
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '#general'
    },
    webhook: {
      enabled: false,
      url: '',
      secret: ''
    },
    notifications: {
      leaveApplicationSubmitted: true,
      leaveApplicationApproved: true,
      leaveApplicationRejected: true,
      scheduleDeployed: true,
      fairnessAlert: true,
      attendanceAnomaly: true
    }
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/notifications')
      const result = await response.json()

      if (result.success && result.data) {
        setSettings(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch notification settings:', error)
      toast({
        variant: 'destructive',
        title: '설정 로드 실패',
        description: '알림 설정을 불러올 수 없습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '저장 완료',
          description: '알림 설정이 성공적으로 저장되었습니다'
        })
      } else {
        throw new Error(result.error || '저장 실패')
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: error.message || '알림 설정 저장 중 오류가 발생했습니다'
      })
    } finally {
      setSaving(false)
    }
  }

  const testEmail = async () => {
    try {
      const response = await fetch('/api/settings/notifications/test-email', {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '테스트 이메일 발송 완료',
          description: '이메일이 성공적으로 발송되었습니다'
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '테스트 실패',
        description: error.message
      })
    }
  }

  const testSlack = async () => {
    try {
      const response = await fetch('/api/settings/notifications/test-slack', {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Slack 테스트 완료',
          description: 'Slack 메시지가 성공적으로 발송되었습니다'
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '테스트 실패',
        description: error.message
      })
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">설정 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <Bell className="w-8 h-8" />
          알림 설정
        </h1>
        <p className="text-gray-600">이메일, Slack, 웹훅 등 알림 채널을 설정합니다</p>
      </div>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            이메일
          </TabsTrigger>
          <TabsTrigger value="slack">
            <MessageSquare className="w-4 h-4 mr-2" />
            Slack
          </TabsTrigger>
          <TabsTrigger value="webhook">
            <Webhook className="w-4 h-4 mr-2" />
            웹훅
          </TabsTrigger>
          <TabsTrigger value="events">
            <Bell className="w-4 h-4 mr-2" />
            알림 이벤트
          </TabsTrigger>
        </TabsList>

        {/* 이메일 설정 */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>이메일 설정</CardTitle>
              <CardDescription>SMTP 서버를 통한 이메일 알림 설정</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-enabled">이메일 알림 활성화</Label>
                <Switch
                  id="email-enabled"
                  checked={settings.email.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, email: { ...settings.email, enabled: checked } })
                  }
                />
              </div>

              {settings.email.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">SMTP 호스트</Label>
                      <Input
                        id="smtp-host"
                        value={settings.email.smtpHost}
                        onChange={(e) =>
                          setSettings({ ...settings, email: { ...settings.email, smtpHost: e.target.value } })
                        }
                        placeholder="smtp.gmail.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">SMTP 포트</Label>
                      <Input
                        id="smtp-port"
                        type="number"
                        value={settings.email.smtpPort}
                        onChange={(e) =>
                          setSettings({ ...settings, email: { ...settings.email, smtpPort: parseInt(e.target.value) } })
                        }
                        placeholder="587"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-user">SMTP 사용자</Label>
                      <Input
                        id="smtp-user"
                        value={settings.email.smtpUser}
                        onChange={(e) =>
                          setSettings({ ...settings, email: { ...settings.email, smtpUser: e.target.value } })
                        }
                        placeholder="user@example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtp-password">SMTP 비밀번호</Label>
                      <Input
                        id="smtp-password"
                        type="password"
                        value={settings.email.smtpPassword}
                        onChange={(e) =>
                          setSettings({ ...settings, email: { ...settings.email, smtpPassword: e.target.value } })
                        }
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="from-email">발신 이메일</Label>
                      <Input
                        id="from-email"
                        type="email"
                        value={settings.email.fromEmail}
                        onChange={(e) =>
                          setSettings({ ...settings, email: { ...settings.email, fromEmail: e.target.value } })
                        }
                        placeholder="noreply@example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="from-name">발신자 이름</Label>
                      <Input
                        id="from-name"
                        value={settings.email.fromName}
                        onChange={(e) =>
                          setSettings({ ...settings, email: { ...settings.email, fromName: e.target.value } })
                        }
                        placeholder="연세바로치과"
                      />
                    </div>
                  </div>

                  <Button onClick={testEmail} variant="outline" className="w-full">
                    <Mail className="w-4 h-4 mr-2" />
                    테스트 이메일 발송
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slack 설정 */}
        <TabsContent value="slack">
          <Card>
            <CardHeader>
              <CardTitle>Slack 설정</CardTitle>
              <CardDescription>Slack 웹훅을 통한 알림 설정</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="slack-enabled">Slack 알림 활성화</Label>
                <Switch
                  id="slack-enabled"
                  checked={settings.slack.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, slack: { ...settings.slack, enabled: checked } })
                  }
                />
              </div>

              {settings.slack.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">웹훅 URL</Label>
                    <Input
                      id="webhook-url"
                      value={settings.slack.webhookUrl}
                      onChange={(e) =>
                        setSettings({ ...settings, slack: { ...settings.slack, webhookUrl: e.target.value } })
                      }
                      placeholder="https://hooks.slack.com/services/..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slack-channel">채널</Label>
                    <Input
                      id="slack-channel"
                      value={settings.slack.channel}
                      onChange={(e) =>
                        setSettings({ ...settings, slack: { ...settings.slack, channel: e.target.value } })
                      }
                      placeholder="#general"
                    />
                  </div>

                  <Button onClick={testSlack} variant="outline" className="w-full">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Slack 테스트 메시지 발송
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 웹훅 설정 */}
        <TabsContent value="webhook">
          <Card>
            <CardHeader>
              <CardTitle>웹훅 설정</CardTitle>
              <CardDescription>커스텀 웹훅을 통한 알림 설정</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="webhook-enabled">웹훅 알림 활성화</Label>
                <Switch
                  id="webhook-enabled"
                  checked={settings.webhook.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, webhook: { ...settings.webhook, enabled: checked } })
                  }
                />
              </div>

              {settings.webhook.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url-custom">웹훅 URL</Label>
                    <Input
                      id="webhook-url-custom"
                      value={settings.webhook.url}
                      onChange={(e) =>
                        setSettings({ ...settings, webhook: { ...settings.webhook, url: e.target.value } })
                      }
                      placeholder="https://your-domain.com/webhook"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhook-secret">시크릿 키 (선택)</Label>
                    <Input
                      id="webhook-secret"
                      type="password"
                      value={settings.webhook.secret}
                      onChange={(e) =>
                        setSettings({ ...settings, webhook: { ...settings.webhook, secret: e.target.value } })
                      }
                      placeholder="••••••••"
                    />
                    <p className="text-xs text-gray-500">
                      HMAC 서명 검증에 사용됩니다
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 알림 이벤트 설정 */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>알림 이벤트</CardTitle>
              <CardDescription>어떤 이벤트에 대해 알림을 받을지 선택하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="leave-submitted">연차 신청 접수</Label>
                    <p className="text-sm text-gray-500">새로운 연차 신청이 접수되었을 때</p>
                  </div>
                  <Switch
                    id="leave-submitted"
                    checked={settings.notifications.leaveApplicationSubmitted}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, leaveApplicationSubmitted: checked }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="leave-approved">연차 신청 승인</Label>
                    <p className="text-sm text-gray-500">연차 신청이 승인되었을 때</p>
                  </div>
                  <Switch
                    id="leave-approved"
                    checked={settings.notifications.leaveApplicationApproved}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, leaveApplicationApproved: checked }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="leave-rejected">연차 신청 거절</Label>
                    <p className="text-sm text-gray-500">연차 신청이 거절되었을 때</p>
                  </div>
                  <Switch
                    id="leave-rejected"
                    checked={settings.notifications.leaveApplicationRejected}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, leaveApplicationRejected: checked }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="schedule-deployed">스케줄 배포</Label>
                    <p className="text-sm text-gray-500">새로운 스케줄이 배포되었을 때</p>
                  </div>
                  <Switch
                    id="schedule-deployed"
                    checked={settings.notifications.scheduleDeployed}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, scheduleDeployed: checked }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="fairness-alert">공정성 경고</Label>
                    <p className="text-sm text-gray-500">공정성 지수가 임계값을 초과했을 때</p>
                  </div>
                  <Switch
                    id="fairness-alert"
                    checked={settings.notifications.fairnessAlert}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, fairnessAlert: checked }
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="attendance-anomaly">근태 이상</Label>
                    <p className="text-sm text-gray-500">근태 이상 징후가 감지되었을 때</p>
                  </div>
                  <Switch
                    id="attendance-anomaly"
                    checked={settings.notifications.attendanceAnomaly}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, attendanceAnomaly: checked }
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 저장 버튼 */}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={fetchSettings} disabled={loading || saving}>
          <RefreshCw className="w-4 h-4 mr-2" />
          초기화
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  )
}
