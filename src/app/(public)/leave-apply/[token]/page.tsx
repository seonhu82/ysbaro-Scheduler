'use client'

import { useState, useEffect } from 'react'
import { DateSelector, type LeaveType } from '@/components/public-apply/DateSelector'
import { RealTimeStatus } from '@/components/public-apply/RealTimeStatus'
import FairnessCheck from '@/components/leave-apply/FairnessCheck'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatDateWithDay } from '@/lib/date-utils'
import { Calendar, Send, CheckCircle2, Key, LogOut } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SlotStatus {
  date: string
  available: number
  total: number
  isHoliday: boolean
}

interface AuthData {
  staffId: string
  staffName: string
  categoryName: string
  clinicId: string
  totalAnnualDays: number
  usedAnnualDays: number
  hasPinCode: boolean
}

interface StaffOption {
  id: string
  name: string
  departmentName: string | null
}

export default function LeaveApplyPage({
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

  // 신청 폼 상태 - 다중 선택 지원
  const [selections, setSelections] = useState<Map<string, LeaveType>>(new Map())
  const [slotStatus, setSlotStatus] = useState<SlotStatus[]>([])
  const [weeklyOffCount, setWeeklyOffCount] = useState(0)

  // 확인 모달
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // PIN 설정 모달
  const [showPinDialog, setShowPinDialog] = useState(false)
  const [newPinCode, setNewPinCode] = useState('')
  const [confirmPinCode, setConfirmPinCode] = useState('')
  const [settingPin, setSettingPin] = useState(false)
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')

  // PIN 재설정 모달
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetMethod, setResetMethod] = useState<'security' | 'birthdate'>('security')
  const [resetStaffId, setResetStaffId] = useState('')
  const [resetBirthDate, setResetBirthDate] = useState('')
  const [resetSecurityAnswer, setResetSecurityAnswer] = useState('')
  const [resetSecurityQuestion, setResetSecurityQuestion] = useState('')
  const [resetNewPin, setResetNewPin] = useState('')
  const [resetConfirmPin, setResetConfirmPin] = useState('')
  const [resettingPin, setResettingPin] = useState(false)

  // 직원 목록 로드
  useEffect(() => {
    const loadStaffList = async () => {
      try {
        const response = await fetch(`/api/leave-apply/${params.token}/staff-list`)
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

  // 슬롯 상태 로드
  const loadSlotStatus = async () => {
    try {
      // 1. 먼저 신청 가능 기간 조회
      const periodResponse = await fetch(`/api/leave-apply/${params.token}/period`)
      const periodResult = await periodResponse.json()

      if (!periodResult.success) {
        toast({
          title: '기간 조회 실패',
          description: periodResult.error || '신청 가능 기간을 조회할 수 없습니다.',
          variant: 'destructive',
        })
        return
      }

      const { startDate, endDate } = periodResult.data

      console.log('📅 신청 가능 기간:', { startDate, endDate })

      // 2. 해당 기간의 슬롯 상태 조회
      const statusResponse = await fetch(
        `/api/leave-apply/${params.token}/status?startDate=${startDate}&endDate=${endDate}`
      )

      const statusResult = await statusResponse.json()

      if (statusResult.success) {
        // slotStatus 형식으로 변환
        const slots = statusResult.status.map((s: any) => ({
          date: new Date(s.date).toISOString().split('T')[0],
          available: s.totalAvailable,
          total: s.requiredStaff,
          isHoliday: s.dayOfWeek === 0 // 일요일
        }))
        setSlotStatus(slots)
        console.log('✅ 슬롯 상태 로드 완료:', slots.length, '일')
      }
    } catch (error) {
      console.error('❌ 슬롯 상태 로드 실패:', error)
      toast({
        title: '데이터 로드 실패',
        description: '날짜별 신청 현황을 불러올 수 없습니다.',
        variant: 'destructive',
      })
    }
  }

  // 인증 처리
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
      const response = await fetch(`/api/leave-apply/${params.token}/auth`, {
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
        setAuthData(result.data)
        toast({
          title: '인증 성공',
          description: `${result.data.staffName}님, 연차/오프 신청이 가능합니다.`,
        })

        // 인증 성공 후 슬롯 상태 로드
        loadSlotStatus()
      } else {
        throw new Error(result.error || '인증 실패')
      }
    } catch (error: any) {
      toast({
        title: '인증 실패',
        description: error.message || 'PIN 번호 또는 생년월일이 올바르지 않습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // 선택 추가/제거 함수
  const handleDateSelection = (date: Date, type: LeaveType) => {
    const dateStr = date.toISOString().split('T')[0]
    const newSelections = new Map(selections)
    newSelections.set(dateStr, type)
    setSelections(newSelections)

    toast({
      title: '선택 추가',
      description: `${dateStr} - ${type === 'ANNUAL' ? '연차' : '오프'}`,
    })
  }

  const handleRemoveSelection = (dateStr: string) => {
    const newSelections = new Map(selections)
    newSelections.delete(dateStr)
    setSelections(newSelections)

    toast({
      title: '선택 제거',
      description: `${dateStr} 선택이 제거되었습니다.`,
    })
  }

  // 일괄 신청 제출
  const handleSubmit = async () => {
    if (selections.size === 0) {
      toast({
        title: '날짜 선택 필요',
        description: '신청할 날짜를 선택해주세요.',
        variant: 'destructive',
      })
      return
    }

    // 연차 잔여 일수 체크
    const annualCount = Array.from(selections.values()).filter(t => t === 'ANNUAL').length
    const remainingAnnual = (authData?.totalAnnualDays || 0) - (authData?.usedAnnualDays || 0)

    if (annualCount > remainingAnnual) {
      toast({
        title: '연차 부족',
        description: `연차 잔여 일수가 부족합니다. (잔여: ${remainingAnnual}일, 신청: ${annualCount}일)`,
        variant: 'destructive',
      })
      return
    }

    setShowConfirm(true)
  }

  const confirmSubmit = async () => {
    setSubmitting(true)

    try {
      const applications = Array.from(selections.entries()).map(([date, type]) => ({
        date,
        type,
      }))

      let successCount = 0
      let failCount = 0
      const errors: string[] = []

      // 각 신청을 순차적으로 처리
      for (const app of applications) {
        try {
          const response = await fetch(`/api/leave-apply/${params.token}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(app),
          })

          const result = await response.json()

          if (result.success) {
            successCount++
          } else {
            failCount++
            errors.push(`${app.date}: ${result.error || '실패'}`)
          }
        } catch (error: any) {
          failCount++
          errors.push(`${app.date}: ${error.message || '오류'}`)
        }
      }

      // 결과 토스트
      if (successCount > 0 && failCount === 0) {
        toast({
          title: '신청 완료',
          description: `${successCount}건의 연차/오프 신청이 완료되었습니다.`,
        })
        setSelections(new Map())
        loadSlotStatus() // 슬롯 상태 새로고침
      } else if (successCount > 0 && failCount > 0) {
        toast({
          title: '일부 신청 실패',
          description: `성공: ${successCount}건, 실패: ${failCount}건\n${errors.join('\n')}`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: '신청 실패',
          description: `모든 신청이 실패했습니다.\n${errors.join('\n')}`,
          variant: 'destructive',
        })
      }

      setShowConfirm(false)
    } catch (error: any) {
      toast({
        title: '신청 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // 보안 질문 목록
  const securityQuestions = [
    '가장 좋아하는 음식은?',
    '첫 직장의 이름은?',
    '어릴 적 별명은?',
    '출신 초등학교는?',
    '좋아하는 영화 제목은?',
  ]

  // PIN 재설정 - 직원 선택 시 보안 질문 조회
  const loadSecurityQuestion = async (staffId: string) => {
    try {
      const response = await fetch(
        `/api/leave-apply/${params.token}/security-question?staffId=${staffId}`
      )
      const result = await response.json()

      if (result.success && result.data.hasSecurityQuestion) {
        setResetSecurityQuestion(result.data.securityQuestion)
        setResetMethod('security')
      } else {
        setResetSecurityQuestion('')
        setResetMethod('birthdate')
      }
    } catch (error) {
      console.error('보안 질문 조회 오류:', error)
      setResetMethod('birthdate')
    }
  }

  // PIN 재설정 처리
  const handleResetPin = async () => {
    if (!resetStaffId) {
      toast({
        title: '직원 선택 필요',
        description: '직원을 선택해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (!resetNewPin || !resetConfirmPin) {
      toast({
        title: 'PIN 입력 필요',
        description: '새 PIN 번호와 확인 번호를 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (!/^\d{6}$/.test(resetNewPin)) {
      toast({
        title: '형식 오류',
        description: 'PIN 번호는 6자리 숫자여야 합니다.',
        variant: 'destructive',
      })
      return
    }

    if (resetNewPin !== resetConfirmPin) {
      toast({
        title: 'PIN 불일치',
        description: 'PIN 번호가 일치하지 않습니다.',
        variant: 'destructive',
      })
      return
    }

    if (resetMethod === 'security' && !resetSecurityAnswer) {
      toast({
        title: '보안 답변 필요',
        description: '보안 답변을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (resetMethod === 'birthdate' && !resetBirthDate) {
      toast({
        title: '생년월일 필요',
        description: '생년월일을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    setResettingPin(true)

    try {
      const response = await fetch(`/api/leave-apply/${params.token}/reset-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: resetStaffId,
          securityAnswer: resetMethod === 'security' ? resetSecurityAnswer : undefined,
          birthDate: resetMethod === 'birthdate' ? resetBirthDate : undefined,
          newPinCode: resetNewPin,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'PIN 재설정 완료',
          description: '새로운 PIN 번호로 로그인해주세요.',
        })
        setShowResetDialog(false)
        // 폼 초기화
        setResetStaffId('')
        setResetBirthDate('')
        setResetSecurityAnswer('')
        setResetNewPin('')
        setResetConfirmPin('')
      } else {
        throw new Error(result.error || 'PIN 재설정 실패')
      }
    } catch (error: any) {
      toast({
        title: 'PIN 재설정 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setResettingPin(false)
    }
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

    if (!/^\d{6}$/.test(newPinCode)) {
      toast({
        title: '형식 오류',
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
    setSelectedDate(undefined)
  }

  if (!isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">연차/오프 신청</h1>
            <p className="text-gray-600">
              직원 인증이 필요합니다
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
                PIN 번호 6자리를 입력하세요. PIN 미설정 시 생년월일(YYMMDD)로 로그인 가능합니다.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading || loadingStaff}>
              {loading ? '인증 중...' : '인증하기'}
            </Button>

            <Button
              type="button"
              variant="link"
              className="w-full text-sm"
              onClick={() => setShowResetDialog(true)}
            >
              PIN 찾기 / 재설정
            </Button>
          </form>
        </Card>

        {/* PIN 재설정 모달 (로그인 전) */}
        <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                PIN 찾기 / 재설정
              </DialogTitle>
              <DialogDescription>
                본인 확인 후 새로운 PIN 번호를 설정할 수 있습니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="resetStaff">직원 선택</Label>
                <Select
                  value={resetStaffId}
                  onValueChange={(value) => {
                    setResetStaffId(value)
                    loadSecurityQuestion(value)
                  }}
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

              {resetStaffId && (
                <>
                  {resetSecurityQuestion ? (
                    <div className="space-y-3 border p-4 rounded-lg bg-blue-50">
                      <div>
                        <Label className="text-sm font-medium">보안 질문</Label>
                        <p className="text-sm text-gray-700 mt-1">{resetSecurityQuestion}</p>
                      </div>
                      <div>
                        <Label htmlFor="resetSecurityAnswer">보안 답변</Label>
                        <Input
                          id="resetSecurityAnswer"
                          type="text"
                          placeholder="답변을 입력하세요"
                          value={resetSecurityAnswer}
                          onChange={(e) => setResetSecurityAnswer(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 border p-4 rounded-lg bg-yellow-50">
                      <p className="text-sm text-gray-700">
                        보안 질문이 설정되지 않았습니다. 생년월일로 본인 확인이 필요합니다.
                      </p>
                      <div>
                        <Label htmlFor="resetBirthDate">생년월일</Label>
                        <Input
                          id="resetBirthDate"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="YYMMDD (예: 951015)"
                          value={resetBirthDate}
                          onChange={(e) => setResetBirthDate(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">새 PIN 번호 설정</p>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="resetNewPin">새 PIN 번호</Label>
                        <Input
                          id="resetNewPin"
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6자리 숫자"
                          value={resetNewPin}
                          onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="resetConfirmPin">새 PIN 번호 확인</Label>
                        <Input
                          id="resetConfirmPin"
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6자리 숫자"
                          value={resetConfirmPin}
                          onChange={(e) => setResetConfirmPin(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResetDialog(false)
                  setResetStaffId('')
                  setResetBirthDate('')
                  setResetSecurityAnswer('')
                  setResetSecurityQuestion('')
                  setResetNewPin('')
                  setResetConfirmPin('')
                }}
                disabled={resettingPin}
              >
                취소
              </Button>
              <Button onClick={handleResetPin} disabled={resettingPin || !resetStaffId}>
                {resettingPin ? '재설정 중...' : 'PIN 재설정'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">연차/오프 신청</h1>
          <p className="text-gray-600">
            {authData && `${authData.staffName}님, `}원하는 날짜와 유형을 선택해서 신청하세요
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPinDialog(true)}
          >
            <Key className="w-4 h-4 mr-2" />
            {authData?.hasPinCode ? 'PIN 변경' : 'PIN 설정'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            로그아웃
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 신청 폼 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 형평성 체크 */}
          {authData && selections.size > 0 && (
            <FairnessCheck
              token={params.token}
              staffId={authData.staffId}
              startDate={new Date(Array.from(selections.keys()).sort()[0])}
              endDate={new Date(Array.from(selections.keys()).sort()[selections.size - 1])}
            />
          )}

          <DateSelector
            selections={selections}
            onDateSelection={handleDateSelection}
            slotStatus={slotStatus}
            categoryName={authData?.categoryName}
          />

          {/* 선택 항목 리스트 */}
          {selections.size > 0 && (
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4">선택된 항목 ({selections.size}개)</h3>
              <div className="space-y-2 mb-4">
                {Array.from(selections.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([dateStr, type]) => (
                    <div key={dateStr} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <div>
                          <span className="font-medium">{formatDateWithDay(new Date(dateStr))}</span>
                          <span className="ml-2 text-sm px-2 py-1 rounded bg-blue-100 text-blue-700">
                            {type === 'ANNUAL' ? '연차' : '오프'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSelection(dateStr)}
                        className="text-red-500 hover:text-red-700"
                      >
                        제거
                      </Button>
                    </div>
                  ))}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="text-xs text-gray-600 mb-1">연차 신청</div>
                  <div className="text-lg font-semibold text-blue-700">
                    {Array.from(selections.values()).filter(t => t === 'ANNUAL').length}일
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">오프 신청</div>
                  <div className="text-lg font-semibold text-green-700">
                    {Array.from(selections.values()).filter(t => t === 'OFF').length}일
                  </div>
                </div>
              </div>

              {authData && (
                <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between">
                    <span>연차 잔여</span>
                    <span className="font-medium">
                      {authData.totalAnnualDays - authData.usedAnnualDays -
                        Array.from(selections.values()).filter(t => t === 'ANNUAL').length}
                      일 / {authData.totalAnnualDays}일
                    </span>
                  </div>
                </div>
              )}
            </Card>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={selections.size === 0}
          >
            <Send className="w-5 h-5 mr-2" />
            일괄 신청하기 ({selections.size}개)
          </Button>
        </div>

        {/* 오른쪽: 실시간 현황 */}
        <div className="lg:col-span-1">
          <RealTimeStatus
            token={params.token}
            selectedDate={selections.size > 0 ? new Date(Array.from(selections.keys())[0]) : undefined}
          />
        </div>
      </div>

      {/* 확인 모달 */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              일괄 신청 확인
            </DialogTitle>
            <DialogDescription>
              총 {selections.size}개 항목을 신청하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">연차</div>
                <div className="text-xl font-bold text-blue-700">
                  {Array.from(selections.values()).filter(t => t === 'ANNUAL').length}일
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">오프</div>
                <div className="text-xl font-bold text-green-700">
                  {Array.from(selections.values()).filter(t => t === 'OFF').length}일
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">신청 목록</h4>
              {Array.from(selections.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([dateStr, type]) => (
                  <div key={dateStr} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm">{formatDateWithDay(new Date(dateStr))}</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      type === 'ANNUAL' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {type === 'ANNUAL' ? '연차' : '오프'}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button onClick={confirmSubmit} disabled={submitting}>
              {submitting ? '신청 중...' : '확인'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* PIN 재설정 모달 */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              PIN 찾기 / 재설정
            </DialogTitle>
            <DialogDescription>
              본인 확인 후 새로운 PIN 번호를 설정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="resetStaff">직원 선택</Label>
              <Select
                value={resetStaffId}
                onValueChange={(value) => {
                  setResetStaffId(value)
                  loadSecurityQuestion(value)
                }}
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

            {resetStaffId && (
              <>
                {resetSecurityQuestion ? (
                  <div className="space-y-3 border p-4 rounded-lg bg-blue-50">
                    <div>
                      <Label className="text-sm font-medium">보안 질문</Label>
                      <p className="text-sm text-gray-700 mt-1">{resetSecurityQuestion}</p>
                    </div>
                    <div>
                      <Label htmlFor="resetSecurityAnswer">보안 답변</Label>
                      <Input
                        id="resetSecurityAnswer"
                        type="text"
                        placeholder="답변을 입력하세요"
                        value={resetSecurityAnswer}
                        onChange={(e) => setResetSecurityAnswer(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 border p-4 rounded-lg bg-yellow-50">
                    <p className="text-sm text-gray-700">
                      보안 질문이 설정되지 않았습니다. 생년월일로 본인 확인이 필요합니다.
                    </p>
                    <div>
                      <Label htmlFor="resetBirthDate">생년월일</Label>
                      <Input
                        id="resetBirthDate"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="YYMMDD (예: 951015)"
                        value={resetBirthDate}
                        onChange={(e) => setResetBirthDate(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">새 PIN 번호 설정</p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="resetNewPin">새 PIN 번호</Label>
                      <Input
                        id="resetNewPin"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6자리 숫자"
                        value={resetNewPin}
                        onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="resetConfirmPin">새 PIN 번호 확인</Label>
                      <Input
                        id="resetConfirmPin"
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6자리 숫자"
                        value={resetConfirmPin}
                        onChange={(e) => setResetConfirmPin(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowResetDialog(false)
                setResetStaffId('')
                setResetBirthDate('')
                setResetSecurityAnswer('')
                setResetSecurityQuestion('')
                setResetNewPin('')
                setResetConfirmPin('')
              }}
              disabled={resettingPin}
            >
              취소
            </Button>
            <Button onClick={handleResetPin} disabled={resettingPin || !resetStaffId}>
              {resettingPin ? '재설정 중...' : 'PIN 재설정'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
