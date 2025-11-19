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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useToast } from '@/hooks/use-toast'
import { Bell, Mail, MessageSquare, Webhook, Save, RefreshCw, HelpCircle } from 'lucide-react'

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
  kakao: {
    enabled: boolean
    apiKey: string
    senderKey: string
    templateCodes: {
      leaveApplication: string
      scheduleDeployed: string
      fairnessAlert: string
    }
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
    kakao: {
      enabled: false,
      apiKey: '',
      senderKey: '',
      templateCodes: {
        leaveApplication: '',
        scheduleDeployed: '',
        fairnessAlert: ''
      }
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

  const testKakao = async () => {
    try {
      const response = await fetch('/api/settings/notifications/test-kakao', {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '카카오톡 테스트 완료',
          description: '카카오톡 메시지가 성공적으로 발송되었습니다'
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
        <p className="text-gray-600">이메일, 카카오톡, 웹훅 등 알림 채널을 설정합니다</p>
      </div>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            이메일
          </TabsTrigger>
          <TabsTrigger value="kakao">
            <MessageSquare className="w-4 h-4 mr-2" />
            카카오톡
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

              {/* 설정 가이드 */}
              <Accordion type="single" collapsible className="border rounded-lg px-4">
                <AccordionItem value="guide" className="border-0">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HelpCircle className="w-4 h-4 text-blue-500" />
                      <span>이메일 설정 가이드</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 text-sm">
                      {/* Gmail 설정 */}
                      <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Gmail 사용 시
                        </h4>

                        <div className="space-y-2 text-blue-900">
                          <p className="font-medium">1단계: 2단계 인증 활성화</p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-blue-800">
                            <li>Google 계정 접속 (myaccount.google.com)</li>
                            <li>보안 메뉴 → 2단계 인증 활성화</li>
                            <li>휴대폰 번호 등록 및 SMS 인증</li>
                          </ul>
                        </div>

                        <div className="space-y-2 text-blue-900">
                          <p className="font-medium">2단계: 앱 비밀번호 생성</p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-blue-800">
                            <li>보안 페이지에서 "앱 비밀번호" 검색</li>
                            <li>앱 선택: 메일</li>
                            <li>기기 선택: 기타 → "연세바로치과" 입력</li>
                            <li>생성 클릭 → 16자리 비밀번호 복사 (공백 제거)</li>
                          </ul>
                        </div>

                        <div className="space-y-2 text-blue-900">
                          <p className="font-medium">3단계: 아래 입력란에 설정</p>
                          <div className="bg-white p-3 rounded border border-blue-200 font-mono text-xs space-y-1">
                            <p>SMTP 호스트: <strong>smtp.gmail.com</strong></p>
                            <p>SMTP 포트: <strong>587</strong></p>
                            <p>SMTP 사용자: <strong>your-email@gmail.com</strong></p>
                            <p>SMTP 비밀번호: <strong>[16자리 앱 비밀번호]</strong></p>
                          </div>
                        </div>

                        <div className="bg-yellow-100 p-2 rounded text-xs text-yellow-900 border border-yellow-300">
                          ⚠️ 일반 Gmail 비밀번호는 작동하지 않습니다. 반드시 앱 비밀번호를 사용하세요!
                        </div>
                      </div>

                      {/* 네이버 설정 */}
                      <div className="bg-green-50 p-4 rounded-lg space-y-3">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          네이버 메일 사용 시
                        </h4>

                        <div className="space-y-2 text-green-900">
                          <p className="font-medium">1단계: SMTP 설정 활성화</p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-green-800">
                            <li>네이버 메일 접속</li>
                            <li>설정 → POP3/IMAP 설정</li>
                            <li>SMTP 사용 ON</li>
                          </ul>
                        </div>

                        <div className="space-y-2 text-green-900">
                          <p className="font-medium">2단계: 아래 입력란에 설정</p>
                          <div className="bg-white p-3 rounded border border-green-200 font-mono text-xs space-y-1">
                            <p>SMTP 호스트: <strong>smtp.naver.com</strong></p>
                            <p>SMTP 포트: <strong>587</strong></p>
                            <p>SMTP 사용자: <strong>your-id@naver.com</strong></p>
                            <p>SMTP 비밀번호: <strong>[네이버 로그인 비밀번호]</strong></p>
                          </div>
                        </div>
                      </div>

                      {/* 회사 메일 */}
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          회사 메일 서버 사용 시
                        </h4>
                        <p className="text-gray-700 text-xs">
                          회사 IT 담당자에게 SMTP 서버 정보(호스트, 포트, 인증 방식)를 문의하세요.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

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

        {/* 카카오톡 설정 */}
        <TabsContent value="kakao">
          <Card>
            <CardHeader>
              <CardTitle>카카오톡 알림 설정</CardTitle>
              <CardDescription>카카오 알림톡/친구톡을 통한 알림 설정</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="kakao-enabled">카카오톡 알림 활성화</Label>
                <Switch
                  id="kakao-enabled"
                  checked={settings.kakao.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, kakao: { ...settings.kakao, enabled: checked } })
                  }
                />
              </div>

              {/* 카카오톡 설정 가이드 */}
              <Accordion type="single" collapsible className="border rounded-lg px-4">
                <AccordionItem value="kakao-guide" className="border-0">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HelpCircle className="w-4 h-4 text-yellow-500" />
                      <span>카카오톡 비즈니스 메시지 설정 가이드</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 text-sm">
                      {/* 알림톡 */}
                      <div className="bg-yellow-50 p-4 rounded-lg space-y-3">
                        <h4 className="font-semibold text-yellow-900 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          카카오 알림톡 (권장)
                        </h4>

                        <div className="space-y-2 text-yellow-900">
                          <p className="text-xs text-yellow-800">
                            공식적인 업무 알림에 적합합니다. 연차 신청, 스케줄 배포 등의 알림을 보낼 수 있습니다.
                          </p>
                        </div>

                        <div className="space-y-2 text-yellow-900">
                          <p className="font-medium">1단계: 카카오 비즈니스 채널 생성</p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-yellow-800">
                            <li>카카오 비즈니스 (business.kakao.com) 접속</li>
                            <li>채널 개설 (사업자 등록번호 필요)</li>
                            <li>채널 검수 완료 대기 (1-3일)</li>
                          </ul>
                        </div>

                        <div className="space-y-2 text-yellow-900">
                          <p className="font-medium">2단계: 카카오 알림톡 서비스 신청</p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-yellow-800">
                            <li>카카오톡 채널 관리자센터 접속</li>
                            <li>알림톡 서비스 신청</li>
                            <li>발신프로필 키(Sender Key) 발급받기</li>
                          </ul>
                        </div>

                        <div className="space-y-2 text-yellow-900">
                          <p className="font-medium">3단계: 메시지 템플릿 등록</p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-yellow-800">
                            <li>연차 신청 알림 템플릿 작성 및 검수 요청</li>
                            <li>스케줄 배포 알림 템플릿 작성</li>
                            <li>공정성 경고 알림 템플릿 작성</li>
                            <li>템플릿 코드 발급받기 (검수 완료 후)</li>
                          </ul>
                        </div>

                        <div className="space-y-2 text-yellow-900">
                          <p className="font-medium">4단계: API 키 발급</p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-yellow-800">
                            <li>카카오 Developers (developers.kakao.com) 접속</li>
                            <li>애플리케이션 추가</li>
                            <li>REST API 키 발급</li>
                          </ul>
                        </div>

                        <div className="bg-white p-3 rounded border border-yellow-200 text-xs space-y-2">
                          <p className="font-medium text-yellow-900">템플릿 예시 (연차 신청):</p>
                          <div className="font-mono text-gray-700 bg-gray-50 p-2 rounded">
                            <p>[연세바로치과 연차 신청]</p>
                            <p>#{'{'}직원명{'}'} 직원이</p>
                            <p>#{'{'}날짜{'}'} 연차를 신청했습니다.</p>
                            <p>승인/거절 처리를 해주세요.</p>
                          </div>
                        </div>

                        <div className="bg-red-100 p-2 rounded text-xs text-red-900 border border-red-300">
                          ⚠️ 주의: 알림톡은 사전 템플릿 검수가 필수이며, 발송 건당 소액의 수수료가 발생합니다.
                        </div>
                      </div>

                      {/* 친구톡 */}
                      <div className="bg-green-50 p-4 rounded-lg space-y-3">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          카카오 친구톡 (대안)
                        </h4>

                        <div className="space-y-2 text-green-900">
                          <p className="text-xs text-green-800">
                            비즈니스 채널을 친구 추가한 사용자에게만 메시지를 보낼 수 있습니다.
                          </p>
                        </div>

                        <div className="space-y-2 text-green-900">
                          <ul className="list-disc list-inside space-y-1 ml-2 text-green-800 text-xs">
                            <li>템플릿 검수 불필요</li>
                            <li>자유로운 메시지 형식</li>
                            <li>수신자가 채널 친구 추가 필수</li>
                            <li>발송 건당 비용 발생</li>
                          </ul>
                        </div>
                      </div>

                      {/* 비용 안내 */}
                      <div className="bg-blue-50 p-3 rounded text-xs text-blue-900 border border-blue-300">
                        <p className="font-semibold mb-1">💰 비용 참고:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>알림톡: 건당 약 7-15원</li>
                          <li>친구톡: 건당 약 15-20원</li>
                          <li>발송량에 따라 할인 적용</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {settings.kakao.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="kakao-api-key">REST API 키</Label>
                    <Input
                      id="kakao-api-key"
                      value={settings.kakao.apiKey}
                      onChange={(e) =>
                        setSettings({ ...settings, kakao: { ...settings.kakao, apiKey: e.target.value } })
                      }
                      placeholder="카카오 Developers에서 발급받은 REST API 키"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="kakao-sender-key">발신프로필 키 (Sender Key)</Label>
                    <Input
                      id="kakao-sender-key"
                      value={settings.kakao.senderKey}
                      onChange={(e) =>
                        setSettings({ ...settings, kakao: { ...settings.kakao, senderKey: e.target.value } })
                      }
                      placeholder="@ABC123 형식"
                    />
                  </div>

                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-semibold">템플릿 코드 설정</p>

                    <div className="space-y-2">
                      <Label htmlFor="template-leave">연차 신청 알림 템플릿 코드</Label>
                      <Input
                        id="template-leave"
                        value={settings.kakao.templateCodes.leaveApplication}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            kakao: {
                              ...settings.kakao,
                              templateCodes: { ...settings.kakao.templateCodes, leaveApplication: e.target.value }
                            }
                          })
                        }
                        placeholder="TEMPLATE_001"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="template-schedule">스케줄 배포 알림 템플릿 코드</Label>
                      <Input
                        id="template-schedule"
                        value={settings.kakao.templateCodes.scheduleDeployed}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            kakao: {
                              ...settings.kakao,
                              templateCodes: { ...settings.kakao.templateCodes, scheduleDeployed: e.target.value }
                            }
                          })
                        }
                        placeholder="TEMPLATE_002"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="template-fairness">공정성 경고 알림 템플릿 코드</Label>
                      <Input
                        id="template-fairness"
                        value={settings.kakao.templateCodes.fairnessAlert}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            kakao: {
                              ...settings.kakao,
                              templateCodes: { ...settings.kakao.templateCodes, fairnessAlert: e.target.value }
                            }
                          })
                        }
                        placeholder="TEMPLATE_003"
                      />
                    </div>
                  </div>

                  <Button onClick={testKakao} variant="outline" className="w-full">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    카카오톡 테스트 메시지 발송
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

              {/* 웹훅 설정 가이드 */}
              <Accordion type="single" collapsible className="border rounded-lg px-4">
                <AccordionItem value="webhook-guide" className="border-0">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HelpCircle className="w-4 h-4 text-orange-500" />
                      <span>웹훅 설정 가이드</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-4 text-sm">
                      <div className="bg-orange-50 p-4 rounded-lg space-y-3">
                        <h4 className="font-semibold text-orange-900 flex items-center gap-2">
                          <Webhook className="w-4 h-4" />
                          커스텀 웹훅 연동
                        </h4>

                        <div className="space-y-2 text-orange-900">
                          <p className="text-xs text-orange-800">
                            자체 서버로 알림을 받고 싶을 때 사용합니다. POST 요청을 받을 수 있는 엔드포인트가 필요합니다.
                          </p>
                        </div>

                        <div className="space-y-2 text-orange-900">
                          <p className="font-medium">요청 형식</p>
                          <div className="bg-white p-3 rounded border border-orange-200 font-mono text-xs space-y-2">
                            <p className="text-gray-600">POST {'{웹훅 URL}'}</p>
                            <p className="text-gray-600">Content-Type: application/json</p>
                            <p className="text-gray-600">X-Webhook-Signature: HMAC-SHA256 (시크릿 키 사용 시)</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-orange-900">
                          <p className="font-medium">페이로드 예시</p>
                          <div className="bg-white p-3 rounded border border-orange-200 font-mono text-xs overflow-x-auto">
                            <pre className="text-gray-700">{`{
  "event": "leave_application_submitted",
  "timestamp": "2025-11-19T10:30:00Z",
  "data": {
    "staffName": "홍길동",
    "date": "2025-11-25",
    "leaveType": "연차"
  }
}`}</pre>
                          </div>
                        </div>

                        <div className="space-y-2 text-orange-900">
                          <p className="font-medium">이벤트 타입</p>
                          <ul className="list-disc list-inside space-y-1 ml-2 text-orange-800 text-xs">
                            <li>leave_application_submitted (연차 신청)</li>
                            <li>leave_application_approved (연차 승인)</li>
                            <li>schedule_deployed (스케줄 배포)</li>
                            <li>fairness_alert (공정성 경고)</li>
                            <li>attendance_anomaly (근태 이상)</li>
                          </ul>
                        </div>

                        <div className="bg-yellow-100 p-2 rounded text-xs text-yellow-900 border border-yellow-300">
                          🔒 시크릿 키를 설정하면 HMAC-SHA256 서명으로 요청을 검증할 수 있습니다
                        </div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded text-xs text-gray-700">
                        <p className="font-semibold mb-1">개발자 참고사항:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>HTTPS 사용 권장</li>
                          <li>3초 이내 응답 필요 (타임아웃)</li>
                          <li>200 OK 응답 시 성공으로 간주</li>
                        </ul>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

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
