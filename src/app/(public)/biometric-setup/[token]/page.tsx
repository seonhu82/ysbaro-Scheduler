'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Fingerprint, Scan, Key, LogOut, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// 보안 질문 목록
const securityQuestions = [
  '가장 좋아하는 음식은?',
  '첫 직장의 이름은?',
  '어릴 적 별명은?',
  '가장 좋아하는 영화는?',
  '졸업한 초등학교는?'
]

interface StaffOption {
  id: string
  name: string
  departmentName: string | null
}

interface AuthData {
  staffId: string
  staffName: string
  biometricEnabled: boolean
  biometricDeviceType?: string
  biometricRegisteredAt?: string
  hasPinCode?: boolean
}

export default function BiometricSetupPage({
  params,
}: {
  params: { token: string }
}) {
  const { toast } = useToast()
  const [isAuth, setIsAuth] = useState(false)
  const [authData, setAuthData] = useState<AuthData | null>(null)
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [pinCode, setPinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [registering, setRegistering] = useState(false)

  // PIN 설정 모달
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [newPinCode, setNewPinCode] = useState('')
  const [confirmPinCode, setConfirmPinCode] = useState('')
  const [settingPin, setSettingPin] = useState(false)
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')

  // 직원 목록 로드 (모든 부서 포함 - 생체 인식 등록은 출퇴근용)
  useEffect(() => {
    const loadStaffList = async () => {
      try {
        const response = await fetch(`/api/public/staff-list/${params.token}`)
        const result = await response.json()

        if (result.success) {
          setStaffList(result.data)
        } else {
          throw new Error(result.error || '직원 목록 로드 실패')
        }
      } catch (error: any) {
        toast({
          title: '오류',
          description: error.message || '직원 목록을 불러오는데 실패했습니다.',
          variant: 'destructive',
        })
      } finally {
        setLoadingStaff(false)
      }
    }

    loadStaffList()
  }, [params.token, toast])

  // 생체인식 정보 새로고침
  const refreshBiometricInfo = async () => {
    if (!authData?.staffId) return

    try {
      const response = await fetch(`/api/biometric/info?staffId=${authData.staffId}`)
      const result = await response.json()

      if (result.success) {
        setAuthData({
          ...authData,
          biometricEnabled: result.data.biometricEnabled,
          biometricDeviceType: result.data.biometricDeviceType,
          biometricRegisteredAt: result.data.biometricRegisteredAt,
        })
      }
    } catch (error) {
      console.error('생체인식 정보 새로고침 실패:', error)
    }
  }

  // 인증 처리 (모든 부서 직원 가능 - 생체 인식 등록은 출퇴근용)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedStaffId) {
      toast({
        title: '직원 선택 필요',
        description: '직원을 선택해주세요.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/public/auth/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaffId,
          pinCode,
        })
      })

      const result = await response.json()

      if (result.success) {
        setIsAuth(true)

        // 생체인식 정보 조회
        const bioResponse = await fetch(`/api/biometric/info?staffId=${selectedStaffId}`)
        const bioResult = await bioResponse.json()

        setAuthData({
          staffId: result.data.staffId,
          staffName: result.data.staffName,
          biometricEnabled: bioResult.success ? bioResult.data.biometricEnabled : false,
          biometricDeviceType: bioResult.success ? bioResult.data.biometricDeviceType : undefined,
          biometricRegisteredAt: bioResult.success ? bioResult.data.biometricRegisteredAt : undefined,
          hasPinCode: result.data.hasPinCode || false,
        })

        toast({
          title: '인증 성공',
          description: `${result.data.staffName}님, 생체인식 등록이 가능합니다.`,
        })
      } else {
        throw new Error(result.error || '인증 실패')
      }
    } catch (error: any) {
      toast({
        title: '인증 실패',
        description: error.message || 'PIN 번호가 올바르지 않습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // 생체인식 등록
  const handleRegisterBiometric = async () => {
    if (!authData) return

    setRegistering(true)

    try {
      // 1. Challenge 요청
      const challengeResponse = await fetch('/api/biometric/register/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: authData.staffId }),
      })

      const challengeData = await challengeResponse.json()
      if (!challengeData.success) {
        throw new Error(challengeData.error || 'Challenge 생성 실패')
      }

      const { options } = challengeData

      // 2. WebAuthn 등록 (브라우저 API)
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge), (c: string) => c.charCodeAt(0)),
          user: {
            ...options.user,
            id: Uint8Array.from(options.user.id, (c: string) => c.charCodeAt(0)),
          },
        },
      })

      if (!credential) {
        throw new Error('생체인증 등록이 취소되었습니다.')
      }

      // 3. Credential 검증 및 저장
      const publicKeyCredential = credential as PublicKeyCredential
      const response = publicKeyCredential.response as AuthenticatorAttestationResponse

      const credentialData = {
        id: publicKeyCredential.id,
        rawId: arrayBufferToBase64(publicKeyCredential.rawId),
        response: {
          attestationObject: arrayBufferToBase64(response.attestationObject),
          clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
        },
        type: publicKeyCredential.type,
        authenticatorAttachment: publicKeyCredential.authenticatorAttachment,
      }

      const verifyResponse = await fetch('/api/biometric/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: authData.staffId,
          credential: credentialData,
          challenge: options.challenge,
        }),
      })

      const verifyData = await verifyResponse.json()
      if (!verifyData.success) {
        throw new Error(verifyData.error || '등록 검증 실패')
      }

      toast({
        title: '등록 완료',
        description: '생체인증이 성공적으로 등록되었습니다.',
      })

      // 정보 새로고침
      await refreshBiometricInfo()
    } catch (error: any) {
      console.error('생체인증 등록 실패:', error)
      toast({
        title: '등록 실패',
        description: error.message || '생체인증 등록에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setRegistering(false)
    }
  }

  // 생체인식 해제
  const handleRemoveBiometric = async () => {
    if (!authData) return

    if (!confirm('생체인증 등록을 해제하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch('/api/biometric/register/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: authData.staffId }),
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || '등록 해제 실패')
      }

      toast({
        title: '해제 완료',
        description: '생체인증이 해제되었습니다.',
      })

      // 정보 새로고침
      await refreshBiometricInfo()
    } catch (error: any) {
      console.error('생체인증 해제 실패:', error)
      toast({
        title: '해제 실패',
        description: error.message || '생체인증 해제에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  // PIN 설정 처리
  const handleSetPin = async () => {
    if (!newPinCode || !confirmPinCode) {
      toast({
        title: 'PIN 입력 필요',
        description: 'PIN 번호와 확인 번호를 모두 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (newPinCode.length !== 6) {
      toast({
        title: '잘못된 형식',
        description: 'PIN 번호는 6자리 숫자여야 합니다.',
        variant: 'destructive',
      })
      return
    }

    if (newPinCode !== confirmPinCode) {
      toast({
        title: 'PIN 불일치',
        description: 'PIN 번호가 일치하지 않습니다.',
        variant: 'destructive',
      })
      return
    }

    if (securityQuestion && !securityAnswer) {
      toast({
        title: '보안 답변 필요',
        description: '보안 질문을 선택하면 답변도 입력해야 합니다.',
        variant: 'destructive',
      })
      return
    }

    setSettingPin(true)

    try {
      const response = await fetch(`/api/leave-apply/${params.token}/set-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: authData?.staffId,
          pinCode: newPinCode,
          securityQuestion: securityQuestion || undefined,
          securityAnswer: securityAnswer || undefined,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'PIN 설정 완료',
          description: '다음부터 PIN 번호로 빠르게 로그인할 수 있습니다.',
        })
        setShowPinDialog(false)
        setNewPinCode('')
        setConfirmPinCode('')
        setSecurityQuestion('')
        setSecurityAnswer('')
        // authData 업데이트
        if (authData) {
          setAuthData({ ...authData, hasPinCode: true })
        }
      } else {
        throw new Error(result.error || 'PIN 설정 실패')
      }
    } catch (error: any) {
      toast({
        title: 'PIN 설정 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSettingPin(false)
    }
  }

  // 로그아웃
  const handleLogout = () => {
    setIsAuth(false)
    setAuthData(null)
    setSelectedStaffId('')
    setPinCode('')
  }

  // 인증 전 화면
  if (!isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4 shadow-lg">
              <Fingerprint className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900">생체인식 등록</h1>
            <p className="text-gray-600">
              지문 또는 안면 인식을 등록하여<br />빠른 출퇴근 체크를 사용하세요
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Label htmlFor="staff">직원 선택</Label>
              <Select
                value={selectedStaffId}
                onValueChange={setSelectedStaffId}
                disabled={loadingStaff}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingStaff ? '로딩 중...' : '직원을 선택하세요'} />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name} {staff.departmentName && `(${staff.departmentName})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pinCode">PIN 번호</Label>
              <Input
                id="pinCode"
                type="password"
                inputMode="numeric"
                placeholder="PIN 번호 (6자리)"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                PIN 번호 6자리를 입력하세요.
              </p>
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700" disabled={loading || loadingStaff}>
              {loading ? '인증 중...' : '인증하기'}
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  // 인증 후 화면
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900">생체인식 등록</h1>
            <p className="text-gray-600">
              {authData?.staffName}님의 생체인식 관리
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPinDialog(true)}
              className="bg-white"
            >
              <Key className="w-4 h-4 mr-2" />
              {authData?.hasPinCode ? 'PIN 변경' : 'PIN 설정'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="bg-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>

        {/* 안내 메시지 */}
        <Alert className="mb-6 border-blue-200 bg-white shadow-sm">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-900 font-bold">
            생체인식이란?
          </AlertTitle>
          <AlertDescription className="text-blue-800 space-y-2">
            <p>
              지문 또는 안면 인식을 등록하면 출퇴근 체크 시 빠르고 안전하게 인증할 수 있습니다.
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>PIN 번호 입력 없이 즉시 출퇴근 체크</li>
              <li>지문 인식기 또는 카메라 필요</li>
              <li>개인정보는 암호화되어 안전하게 보관</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* 현재 등록 상태 */}
        <Card className="mb-6 p-6 bg-white shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-900">등록 현황</h2>

          {authData?.biometricEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900">생체인증이 등록되어 있습니다</p>
                  <div className="text-sm text-green-700 mt-1 space-y-1">
                    {authData.biometricDeviceType && (
                      <p>
                        타입: {authData.biometricDeviceType === 'fingerprint' ? '🔐 지문 인식' : '👤 안면 인식'}
                      </p>
                    )}
                    {authData.biometricRegisteredAt && (
                      <p>
                        등록일: {new Date(authData.biometricRegisteredAt).toLocaleString('ko-KR')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleRemoveBiometric}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                등록 해제
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                <AlertCircle className="w-6 h-6 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">생체인증이 등록되지 않았습니다</p>
                  <p className="text-sm text-gray-600 mt-1">
                    아래 버튼을 눌러 지문 또는 안면 인식을 등록하세요
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 등록 버튼 */}
        {!authData?.biometricEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 지문 인식 등록 */}
            <Card className="p-6 bg-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={handleRegisterBiometric}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
                  <Fingerprint className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">지문 인식 등록</h3>
                <p className="text-sm text-gray-600 mb-4">
                  지문 인식기를 사용하여 등록합니다
                </p>
                <Button
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  disabled={registering}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRegisterBiometric()
                  }}
                >
                  {registering ? '등록 중...' : '지문 등록하기'}
                </Button>
              </div>
            </Card>

            {/* 안면 인식 등록 */}
            <Card className="p-6 bg-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={handleRegisterBiometric}>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mb-4">
                  <Scan className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-900">안면 인식 등록</h3>
                <p className="text-sm text-gray-600 mb-4">
                  카메라를 사용하여 얼굴을 등록합니다
                </p>
                <Button
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                  disabled={registering}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRegisterBiometric()
                  }}
                >
                  {registering ? '등록 중...' : '안면 등록하기'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* 도움말 */}
        <Card className="mt-6 p-6 bg-white shadow-lg">
          <h3 className="text-lg font-bold mb-3 text-gray-900">자주 묻는 질문</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-gray-900">Q. 지문 인식과 안면 인식 중 무엇을 선택해야 하나요?</p>
              <p className="text-gray-600 mt-1">
                A. 사용 가능한 장치에 따라 선택하세요. 지문 인식기가 있으면 지문을, 카메라만 있으면 안면 인식을 선택하세요.
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Q. 등록한 생체인식 정보는 안전한가요?</p>
              <p className="text-gray-600 mt-1">
                A. 네, 모든 생체인식 데이터는 암호화되어 안전하게 보관됩니다. 원본 지문이나 얼굴 이미지는 저장되지 않습니다.
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Q. 생체인식 등록을 해제할 수 있나요?</p>
              <p className="text-gray-600 mt-1">
                A. 네, 언제든지 '등록 해제' 버튼을 눌러 해제할 수 있습니다.
              </p>
            </div>
          </div>
        </Card>

        {/* PIN 설정 모달 */}
        <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                PIN 번호 {authData?.hasPinCode ? '변경' : '설정'}
              </DialogTitle>
              <DialogDescription>
                {authData?.hasPinCode
                  ? '새로운 PIN 번호를 설정하세요. 6자리 숫자를 입력해주세요.'
                  : 'PIN 번호를 설정하면 다음부터 빠르게 로그인할 수 있습니다. 6자리 숫자를 입력해주세요.'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="newPin">PIN 번호</Label>
                <Input
                  id="newPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6자리 숫자"
                  value={newPinCode}
                  onChange={(e) => setNewPinCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div>
                <Label htmlFor="confirmPin">PIN 번호 확인</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6자리 숫자"
                  value={confirmPinCode}
                  onChange={(e) => setConfirmPinCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-3">
                  보안 질문 설정 (선택사항 - PIN 분실 시 재설정에 사용)
                </p>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="securityQuestion">보안 질문</Label>
                    <Select
                      value={securityQuestion}
                      onValueChange={setSecurityQuestion}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="보안 질문을 선택하세요 (선택사항)" />
                      </SelectTrigger>
                      <SelectContent>
                        {securityQuestions.map((q, idx) => (
                          <SelectItem key={idx} value={q}>
                            {q}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {securityQuestion && (
                    <div>
                      <Label htmlFor="securityAnswer">보안 답변</Label>
                      <Input
                        id="securityAnswer"
                        type="text"
                        placeholder="답변을 입력하세요"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPinDialog(false)
                  setNewPinCode('')
                  setConfirmPinCode('')
                  setSecurityQuestion('')
                  setSecurityAnswer('')
                }}
                disabled={settingPin}
              >
                취소
              </Button>
              <Button onClick={handleSetPin} disabled={settingPin}>
                {settingPin ? '설정 중...' : '설정'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
