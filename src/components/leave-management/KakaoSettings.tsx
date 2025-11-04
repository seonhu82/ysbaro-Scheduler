'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { MessageCircle, Save, RefreshCw, ExternalLink } from 'lucide-react'

interface KakaoSettingsData {
  javascriptKey: string
  leaveApplicationTemplate: string
  useDefaultTemplate: boolean
}

export function KakaoSettings() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<KakaoSettingsData>({
    javascriptKey: '',
    leaveApplicationTemplate: '',
    useDefaultTemplate: true,
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/kakao-settings')
      const result = await response.json()

      if (result.success) {
        setSettings(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch kakao settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/kakao-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '저장 완료',
          description: '카카오톡 설정이 저장되었습니다.',
        })
      } else {
        throw new Error(result.error || '저장 실패')
      }
    } catch (error: any) {
      toast({
        title: '저장 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
        <p className="text-gray-600">로딩 중...</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 안내 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <MessageCircle className="w-5 h-5" />
            카카오톡 설정
          </CardTitle>
          <CardDescription className="text-blue-700">
            카카오톡 공유 기능을 사용하려면 JavaScript 키가 필요합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-2">설정 방법:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>카카오 개발자 사이트에서 애플리케이션을 생성합니다</li>
              <li>JavaScript 키를 복사하여 아래에 입력합니다</li>
              <li>플랫폼 설정에서 웹 플랫폼을 추가하고 도메인을 등록합니다</li>
              <li>저장 후 카카오톡 공유 기능을 사용할 수 있습니다</li>
            </ol>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
            onClick={() => window.open('https://developers.kakao.com', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            카카오 개발자 사이트 바로가기
          </Button>
        </CardContent>
      </Card>

      {/* JavaScript 키 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>JavaScript 키</CardTitle>
          <CardDescription>
            카카오 개발자 사이트에서 발급받은 JavaScript 키를 입력하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="javascriptKey">JavaScript 키</Label>
            <Input
              id="javascriptKey"
              type="text"
              placeholder="예: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
              value={settings.javascriptKey}
              onChange={(e) => setSettings({ ...settings, javascriptKey: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              키는 안전하게 저장되며 카카오톡 공유 시에만 사용됩니다
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 메시지 템플릿 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>연차/오프 신청 안내 메시지</CardTitle>
          <CardDescription>
            카카오톡으로 공유할 때 전송될 메시지를 설정합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>기본 템플릿 사용</Label>
              <p className="text-xs text-gray-500">
                기본 제공되는 메시지 템플릿을 사용합니다
              </p>
            </div>
            <Switch
              checked={settings.useDefaultTemplate}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, useDefaultTemplate: checked })
              }
            />
          </div>

          {!settings.useDefaultTemplate && (
            <div>
              <Label htmlFor="template">커스텀 메시지</Label>
              <Textarea
                id="template"
                rows={10}
                placeholder="안녕하세요!&#10;&#10;연차/오프 신청 기간이 시작되었습니다.&#10;아래 링크를 통해 희망하시는 날짜를 신청해주세요.&#10;&#10;📅 신청 링크: {link}&#10;&#10;감사합니다."
                value={settings.leaveApplicationTemplate}
                onChange={(e) =>
                  setSettings({ ...settings, leaveApplicationTemplate: e.target.value })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                {'{link}'}를 포함하면 해당 위치에 신청 링크가 삽입됩니다
              </p>
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

      {/* 데이터베이스 마이그레이션 필요 안내 */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-900">
            <strong>주의:</strong> 이 기능을 사용하려면 먼저 데이터베이스 마이그레이션이 필요합니다.
            터미널에서 다음 명령어를 실행해주세요:
          </p>
          <code className="block mt-2 p-3 bg-gray-900 text-gray-100 rounded text-xs">
            npx prisma migrate dev --name add-kakao-settings
          </code>
        </CardContent>
      </Card>
    </div>
  )
}
