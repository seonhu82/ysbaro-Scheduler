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
import { formatDateWithDay, formatDate } from '@/lib/date-utils'
import { Calendar, Send, CheckCircle2, Key, LogOut, AlertCircle, Info } from 'lucide-react'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface SlotStatus {
  totalSlots: number
  totalOffSlots: number
  totalAnnualSlots: number
  availableSlots: number
  availableOffSlots: number
  availableAnnualSlots: number
  appliedOffCount: number
  appliedAnnualCount: number
  appliedCount: number
  holidayDates: string[]
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

interface Statistics {
  staffName: string
  categoryName: string
  totalBusinessDays: number
  expectedOffDays: number
  currentApprovedCount: number
  remainingAutoOff: number
  applicationRatio: number
  recommendedMaxApplications: number
  guidelines: {
    status: 'good' | 'warning' | 'critical'
    message: string
  }
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
  const [slotStatus, setSlotStatus] = useState<SlotStatus | null>(null)
  const [weeklyOffCount, setWeeklyOffCount] = useState(0)
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [fairnessData, setFairnessData] = useState<any>(null) // 형평성 데이터 (한도 체크용)

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

  // 통계 로드
  const loadStatistics = async (staffId: string) => {
    try {
      const response = await fetch(`/api/leave-apply/${params.token}/statistics?staffId=${staffId}`)
      const result = await response.json()

      if (result.success) {
        setStatistics(result.data)
        console.log('✅ 통계 로드 완료:', result.data)
      }
    } catch (error) {
      console.error('❌ 통계 로드 실패:', error)
    }
  }

  // 형평성 데이터 로드
  const loadFairnessData = async (staffId: string) => {
    try {
      const response = await fetch(`/api/leave-apply/${params.token}/fairness?staffId=${staffId}`)
      const result = await response.json()

      if (result.success) {
        setFairnessData(result.data)
        console.log('✅ 형평성 데이터 로드 완료:', result.data)
      }
    } catch (error) {
      console.error('❌ 형평성 데이터 로드 실패:', error)
    }
  }

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

      // 2. 해당 기간의 슬롯 상태 조회 (URL 인코딩)
      const statusResponse = await fetch(
        `/api/leave-apply/${params.token}/status?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
      )

      const statusResult = await statusResponse.json()

      if (statusResult.success && statusResult.summary) {
        // 새로운 summary 형식의 데이터 사용
        const summary = statusResult.summary
        console.log('✅ 슬롯 상태 로드 완료:', summary)
        console.log('📊 전체 휴무 슬롯:', summary.totalSlots)
        console.log('📊 신청된 오프:', summary.appliedOffCount)
        console.log('📊 신청된 연차:', summary.appliedAnnualCount)
        console.log('📊 신청 가능:', summary.availableSlots)

        // RealTimeStatus 컴포넌트용 데이터 설정
        setSlotStatus({
          totalSlots: summary.totalSlots,
          totalOffSlots: summary.totalOffSlots,
          totalAnnualSlots: summary.totalAnnualSlots,
          availableSlots: summary.availableSlots,
          availableOffSlots: summary.availableOffSlots,
          availableAnnualSlots: summary.availableAnnualSlots,
          appliedOffCount: summary.appliedOffCount,
          appliedAnnualCount: summary.appliedAnnualCount,
          appliedCount: summary.appliedCount,
          holidayDates: summary.holidayDates || []
        })
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

        // 인증 성공 후 슬롯 상태 및 통계, 형평성 데이터 로드
        loadSlotStatus()
        loadStatistics(selectedStaffId)
        loadFairnessData(selectedStaffId)
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
  const handleDateSelection = async (date: Date, type: LeaveType) => {
    const dateStr = formatDate(date) // 타임존 이슈 방지

    if (!authData?.staffId) return

    console.log('🎯 날짜 선택:', dateStr, type)

    // 실시간 시뮬레이션으로 신청 가능 여부 체크
    try {
      // 현재 선택하려는 날짜의 주 시작일/종료일 계산 (UTC 기준, 일~토)
      const currentDate = new Date(date)
      const day = currentDate.getUTCDay()
      const weekStart = new Date(currentDate)
      weekStart.setUTCDate(currentDate.getUTCDate() - day)
      weekStart.setUTCHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekStart.getUTCDate() + 6)
      weekEnd.setUTCHours(23, 59, 59, 999)

      console.log('📅 현재 선택 날짜의 주 범위:',
        weekStart.toISOString().split('T')[0], '~',
        weekEnd.toISOString().split('T')[0])

      // 이미 선택한 OFF 중 같은 주에 속한 것만 필터링 (주4일 제약용)
      const existingOffs = Array.from(selections.entries())
        .filter(([d, t]) => {
          if (t !== 'OFF') return false
          const offDate = new Date(d)
          return offDate >= weekStart && offDate <= weekEnd
        })
        .map(([d, _]) => d)

      console.log('📊 같은 주에 이미 선택한 OFF:', existingOffs)

      // 모든 선택된 OFF (형평성 체크용) - 현재 날짜 제외
      const allPendingOffs = Array.from(selections.entries())
        .filter(([d, t]) => t === 'OFF' && d !== dateStr)
        .map(([d, _]) => d)

      console.log('📊 전체 선택 중인 OFF:', allPendingOffs)

      // 파라미터 구성
      const existingOffsParam = existingOffs.length > 0
        ? `&existingOffsInWeek=${existingOffs.join(',')}`
        : ''

      const pendingSelectionsParam = allPendingOffs.length > 0
        ? `&pendingSelections=${allPendingOffs.join(',')}`
        : ''

      const response = await fetch(
        `/api/leave-apply/${params.token}/can-apply?staffId=${authData.staffId}&date=${dateStr}&type=${type}${existingOffsParam}${pendingSelectionsParam}`
      )
      const result = await response.json()

      console.log('✅ 시뮬레이션 결과:', result)

      if (!result.success || !result.canApply) {
        toast({
          title: result.message || '신청 불가',
          description: result.technicalReason || '해당 날짜에 신청할 수 없습니다',
          variant: 'destructive',
        })
        return
      }

      // 시뮬레이션 통과 → 선택 추가
      const newSelections = new Map(selections)
      newSelections.set(dateStr, type)
      setSelections(newSelections)

      toast({
        title: '선택 추가',
        description: `${dateStr} - ${type === 'ANNUAL' ? '연차' : '오프'}`,
      })
    } catch (error) {
      console.error('❌ 신청 가능 여부 체크 실패:', error)
      toast({
        title: '오류',
        description: '신청 가능 여부를 확인하는 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    }
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
          const response = await fetch(`/api/leave-apply/${params.token}/submit-v3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(app),
          })

          const result = await response.json()

          if (result.success) {
            successCount++
          } else {
            failCount++
            // 동적 제한 시스템의 상세 에러 메시지 사용
            const errorMsg = result.userMessage
              ? `${result.userMessage.title}\n${result.userMessage.message}\n💡 ${result.userMessage.suggestion}`
              : result.error || '실패'
            errors.push(`${app.date}: ${errorMsg}`)
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
        if (authData?.staffId) {
          loadStatistics(authData.staffId) // 통계 새로고침
          loadFairnessData(authData.staffId) // 형평성 데이터 새로고침
        }
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

      {/* 중요 안내 사항 */}
      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <Info className="h-5 w-5 text-blue-600" />
        <AlertTitle className="text-blue-900 font-bold mb-2">
          연차/오프 신청 전 꼭 읽어주세요!
        </AlertTitle>
        <AlertDescription className="text-blue-800 space-y-2">
          <div className="space-y-1">
            <p className="font-semibold">✅ 꼭 필요한 날짜만 신청해주세요</p>
            <p className="text-sm ml-4">
              • 병원 방문, 개인 약속 등 <strong>반드시 쉬어야 하는 날짜</strong>만 신청
            </p>
            <p className="text-sm ml-4">
              • 나머지 OFF는 <strong>자동 배치 시스템이 형평성을 고려하여 자동 배분</strong>합니다
            </p>
          </div>
          <div className="space-y-1 pt-2 border-t border-blue-200">
            <p className="font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              과도한 신청은 전체 스케줄 생성에 문제를 일으킬 수 있습니다
            </p>
            <p className="text-sm ml-4">
              • 신청이 많을수록 자동 배치의 유연성이 감소합니다
            </p>
            <p className="text-sm ml-4">
              • 모든 직원의 형평성 있는 배치가 어려워질 수 있습니다
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* 신청 현황 통계 */}
      {statistics && (
        <Card className="mb-6 p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {statistics.staffName}님의 이번 달 신청 현황
              </h3>
              <p className="text-sm text-gray-600">
                {statistics.categoryName} • 전체 영업일 {statistics.totalBusinessDays}일
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs text-gray-600 mb-1">예상 OFF 일수</div>
              <div className="text-2xl font-bold text-blue-600">
                {statistics.expectedOffDays}일
              </div>
              <div className="text-xs text-gray-500 mt-1">
                (영업일의 약 {Math.round((statistics.expectedOffDays / statistics.totalBusinessDays) * 100)}%)
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs text-gray-600 mb-1">현재 신청</div>
              <div className={`text-2xl font-bold ${
                statistics.guidelines.status === 'good' ? 'text-green-600' :
                statistics.guidelines.status === 'warning' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {statistics.currentApprovedCount}일
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ({statistics.applicationRatio}%)
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs text-gray-600 mb-1">자동 배치 예정</div>
              <div className="text-2xl font-bold text-purple-600">
                {statistics.remainingAutoOff}일
              </div>
              <div className="text-xs text-gray-500 mt-1">
                형평성 기반 배분
              </div>
            </div>
          </div>

          <Alert className={`${
            statistics.guidelines.status === 'good' ? 'border-green-200 bg-green-50' :
            statistics.guidelines.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
            'border-red-200 bg-red-50'
          }`}>
            <AlertCircle className={`h-4 w-4 ${
              statistics.guidelines.status === 'good' ? 'text-green-600' :
              statistics.guidelines.status === 'warning' ? 'text-yellow-600' :
              'text-red-600'
            }`} />
            <AlertDescription className={`${
              statistics.guidelines.status === 'good' ? 'text-green-800' :
              statistics.guidelines.status === 'warning' ? 'text-yellow-800' :
              'text-red-800'
            }`}>
              {statistics.guidelines.message}
            </AlertDescription>
          </Alert>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 신청 폼 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 형평성 체크 */}
          {authData && (
            <FairnessCheck
              token={params.token}
              staffId={authData.staffId}
              startDate={new Date()}
              endDate={new Date()}
            />
          )}

          <DateSelector
            selections={selections}
            onDateSelection={handleDateSelection}
            categoryName={authData?.categoryName}
            holidayDates={slotStatus?.holidayDates || []}
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
            slotStatus={slotStatus}
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
