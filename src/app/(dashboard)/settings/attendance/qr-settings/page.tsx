/**
 * QR 및 인증 설정 페이지
 * 경로: /settings/attendance/qr-settings
 *
 * 기능:
 * - 생체인식 등록 URL 관리
 * - 태블릿 출퇴근 체크 URL 관리
 * - 출퇴근 체크 방법 설정
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Fingerprint, Tablet, Settings, Copy, Check, QrCode, Scan } from 'lucide-react'

export default function QRSettingsPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [biometricUrl, setBiometricUrl] = useState<string>('')
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tabletUrl, setTabletUrl] = useState<string>('')
  const [copiedTablet, setCopiedTablet] = useState(false)

  // 출퇴근 체크 방법 설정
  const [checkMethods, setCheckMethods] = useState({
    qrCode: true,
    fingerprint: true,
    face: true,
  })
  const [savingMethods, setSavingMethods] = useState(false)

  // QR 코드 URL 설정
  const [useExternalUrl, setUseExternalUrl] = useState(false)
  const [savingUrlSetting, setSavingUrlSetting] = useState(false)

  // 출퇴근 체크 방법 및 URL 설정 로드
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/attendance/settings')
        const result = await response.json()

        if (result.success && result.data) {
          const methods = result.data.methods || []
          setCheckMethods({
            qrCode: methods.includes('QR_CODE'),
            fingerprint: methods.includes('BIOMETRIC_FINGERPRINT'),
            face: methods.includes('BIOMETRIC_FACE'),
          })

          // QR URL 설정 로드
          if (result.data.useExternalUrlForQR !== undefined) {
            setUseExternalUrl(result.data.useExternalUrlForQR)
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      }
    }

    fetchSettings()
  }, [])

  // 생체인식 등록 URL 생성
  const generateBiometricUrl = async () => {
    setLoadingUrl(true)
    try {
      const response = await fetch('/api/deploy/biometric-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const result = await response.json()

      if (result.success && result.data?.publicUrl) {
        setBiometricUrl(result.data.publicUrl)
        toast({
          title: 'URL 생성 완료',
          description: '생체인식 등록 URL이 생성되었습니다.',
        })
      } else {
        throw new Error(result.error || 'URL 생성 실패')
      }
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || 'URL 생성에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoadingUrl(false)
    }
  }

  // URL 복사
  const copyBiometricUrl = async () => {
    if (!biometricUrl) {
      await generateBiometricUrl()
      return
    }

    try {
      await navigator.clipboard.writeText(biometricUrl)
      setCopied(true)
      toast({
        title: '복사 완료',
        description: '생체인식 등록 URL이 클립보드에 복사되었습니다.',
      })

      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (error) {
      toast({
        title: '복사 실패',
        description: '클립보드 복사에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  // 태블릿 URL 생성
  const generateTabletUrl = () => {
    const url = `${window.location.origin}/tablet/attendance`
    setTabletUrl(url)
    toast({
      title: 'URL 생성 완료',
      description: '태블릿 출퇴근 체크 URL이 생성되었습니다.',
    })
  }

  // 태블릿 URL 복사
  const copyTabletUrl = async () => {
    if (!tabletUrl) {
      generateTabletUrl()
      // URL 생성 후 약간의 지연을 두고 복사
      setTimeout(async () => {
        try {
          const url = `${window.location.origin}/tablet/attendance`
          await navigator.clipboard.writeText(url)
          setCopiedTablet(true)
          toast({
            title: '복사 완료',
            description: '태블릿 출퇴근 체크 URL이 클립보드에 복사되었습니다.',
          })

          setTimeout(() => {
            setCopiedTablet(false)
          }, 2000)
        } catch (error) {
          toast({
            title: '복사 실패',
            description: '클립보드 복사에 실패했습니다.',
            variant: 'destructive',
          })
        }
      }, 100)
      return
    }

    try {
      await navigator.clipboard.writeText(tabletUrl)
      setCopiedTablet(true)
      toast({
        title: '복사 완료',
        description: '태블릿 출퇴근 체크 URL이 클립보드에 복사되었습니다.',
      })

      setTimeout(() => {
        setCopiedTablet(false)
      }, 2000)
    } catch (error) {
      toast({
        title: '복사 실패',
        description: '클립보드 복사에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  // QR URL 설정 저장
  const saveUrlSetting = async () => {
    setSavingUrlSetting(true)
    try {
      const response = await fetch('/api/attendance/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useExternalUrlForQR: useExternalUrl }),
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || '저장 실패')
      }

      toast({
        title: '저장 완료',
        description: 'QR URL 설정이 저장되었습니다.',
      })
    } catch (error: any) {
      toast({
        title: '저장 실패',
        description: error.message || '설정 저장에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setSavingUrlSetting(false)
    }
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
        <h1 className="text-2xl font-bold mb-2">QR 및 인증 설정</h1>
        <p className="text-gray-600">
          출퇴근 체크를 위한 QR 코드, 생체인식 등 인증 방법을 설정합니다
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* QR URL 설정 */}
        <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-600" />
              <span className="text-amber-900">QR 코드 URL 설정</span>
            </CardTitle>
            <CardDescription>
              태블릿에서 생성되는 QR 코드의 URL 형식을 선택하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div>
                  <Label htmlFor="external-url" className="text-base font-medium cursor-pointer">
                    테스트용 외부 IP 사용
                  </Label>
                  <p className="text-sm text-gray-500 mt-1">
                    활성화: 외부 IP 주소 사용 (예: NEXT_PUBLIC_APP_URL)<br />
                    비활성화: localhost:3000 사용 (로컬 테스트)
                  </p>
                </div>
                <Switch
                  id="external-url"
                  checked={useExternalUrl}
                  onCheckedChange={setUseExternalUrl}
                  disabled={savingUrlSetting}
                />
              </div>

              <Button
                onClick={saveUrlSetting}
                disabled={savingUrlSetting}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {savingUrlSetting ? '저장 중...' : 'URL 설정 저장'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 생체인식 등록 URL */}
        <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-indigo-600" />
              <span className="text-indigo-900">생체인식 등록 URL</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                직원들이 지문 또는 안면 인식을 등록할 수 있는 URL입니다.
                이 링크를 직원들에게 공유하면 각자 생체인식을 등록할 수 있습니다.
              </p>

              {biometricUrl && (
                <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-indigo-200">
                  <code className="flex-1 text-sm text-gray-700 overflow-x-auto">
                    {biometricUrl}
                  </code>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={generateBiometricUrl}
                  disabled={loadingUrl}
                  variant="outline"
                  className="flex-1"
                >
                  <Fingerprint className="w-4 h-4 mr-2" />
                  {loadingUrl ? 'URL 생성 중...' : biometricUrl ? 'URL 재생성' : 'URL 생성'}
                </Button>

                <Button
                  onClick={copyBiometricUrl}
                  disabled={loadingUrl || (!biometricUrl && !loadingUrl)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      복사 완료!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      URL 복사
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 태블릿 출퇴근 체크 URL */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tablet className="w-5 h-5 text-green-600" />
              <span className="text-green-900">태블릿 출퇴근 체크 URL</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                태블릿이나 비치용 기기에 설정하여 직원들이 출퇴근을 체크할 수 있는 페이지입니다.
                전체화면 모드로 사용하면 편리합니다.
              </p>

              {tabletUrl && (
                <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-green-200">
                  <code className="flex-1 text-sm text-gray-700 overflow-x-auto">
                    {tabletUrl}
                  </code>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={generateTabletUrl}
                  variant="outline"
                  className="flex-1"
                >
                  <Tablet className="w-4 h-4 mr-2" />
                  {tabletUrl ? 'URL 재생성' : 'URL 생성'}
                </Button>

                <Button
                  onClick={copyTabletUrl}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {copiedTablet ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      복사 완료!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      URL 복사
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 출퇴근 체크 방법 설정 */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-600" />
              <span className="text-purple-900">출퇴근 체크 방법 설정</span>
            </CardTitle>
            <CardDescription>
              태블릿 출퇴근 페이지에서 사용할 인증 방법을 선택하세요. 최소 1개 이상 선택해야 합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* QR코드 */}
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <QrCode className="w-5 h-5 text-purple-600" />
                  <div>
                    <Label htmlFor="qr-code" className="text-base font-medium cursor-pointer">
                      QR 코드
                    </Label>
                    <p className="text-sm text-gray-500">
                      QR 코드 스캔으로 출퇴근 체크
                    </p>
                  </div>
                </div>
                <Switch
                  id="qr-code"
                  checked={checkMethods.qrCode}
                  onCheckedChange={(checked) => {
                    // 최소 1개는 선택되어야 함
                    const otherMethodsCount = (checkMethods.fingerprint ? 1 : 0) + (checkMethods.face ? 1 : 0)
                    if (!checked && otherMethodsCount === 0) {
                      toast({
                        title: '오류',
                        description: '최소 1개 이상의 체크 방법을 선택해야 합니다.',
                        variant: 'destructive',
                      })
                      return
                    }
                    setCheckMethods(prev => ({ ...prev, qrCode: checked }))
                  }}
                  disabled={savingMethods}
                />
              </div>

              {/* 지문 인식 */}
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-purple-600" />
                  <div>
                    <Label htmlFor="fingerprint" className="text-base font-medium cursor-pointer">
                      지문 인식
                    </Label>
                    <p className="text-sm text-gray-500">
                      생체인식 (지문)으로 출퇴근 체크
                    </p>
                  </div>
                </div>
                <Switch
                  id="fingerprint"
                  checked={checkMethods.fingerprint}
                  onCheckedChange={(checked) => {
                    const otherMethodsCount = (checkMethods.qrCode ? 1 : 0) + (checkMethods.face ? 1 : 0)
                    if (!checked && otherMethodsCount === 0) {
                      toast({
                        title: '오류',
                        description: '최소 1개 이상의 체크 방법을 선택해야 합니다.',
                        variant: 'destructive',
                      })
                      return
                    }
                    setCheckMethods(prev => ({ ...prev, fingerprint: checked }))
                  }}
                  disabled={savingMethods}
                />
              </div>

              {/* 안면 인식 */}
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-3">
                  <Scan className="w-5 h-5 text-purple-600" />
                  <div>
                    <Label htmlFor="face" className="text-base font-medium cursor-pointer">
                      안면 인식
                    </Label>
                    <p className="text-sm text-gray-500">
                      생체인식 (안면)으로 출퇴근 체크
                    </p>
                  </div>
                </div>
                <Switch
                  id="face"
                  checked={checkMethods.face}
                  onCheckedChange={(checked) => {
                    const otherMethodsCount = (checkMethods.qrCode ? 1 : 0) + (checkMethods.fingerprint ? 1 : 0)
                    if (!checked && otherMethodsCount === 0) {
                      toast({
                        title: '오류',
                        description: '최소 1개 이상의 체크 방법을 선택해야 합니다.',
                        variant: 'destructive',
                      })
                      return
                    }
                    setCheckMethods(prev => ({ ...prev, face: checked }))
                  }}
                  disabled={savingMethods}
                />
              </div>

              {/* 저장 버튼 */}
              <Button
                onClick={async () => {
                  setSavingMethods(true)
                  try {
                    const methods = []
                    if (checkMethods.qrCode) methods.push('QR_CODE')
                    if (checkMethods.fingerprint) methods.push('BIOMETRIC_FINGERPRINT')
                    if (checkMethods.face) methods.push('BIOMETRIC_FACE')

                    const response = await fetch('/api/attendance/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ methods }),
                    })

                    const result = await response.json()
                    if (!result.success) {
                      throw new Error(result.error || '저장 실패')
                    }

                    toast({
                      title: '저장 완료',
                      description: '출퇴근 체크 방법 설정이 저장되었습니다.',
                    })
                  } catch (error: any) {
                    toast({
                      title: '저장 실패',
                      description: error.message || '설정 저장에 실패했습니다.',
                      variant: 'destructive',
                    })
                  } finally {
                    setSavingMethods(false)
                  }
                }}
                disabled={savingMethods}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {savingMethods ? '저장 중...' : '설정 저장'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
