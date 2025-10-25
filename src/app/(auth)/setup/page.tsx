'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1: 클리닉 정보
  const [clinicInfo, setClinicInfo] = useState({
    name: '',
    address: '',
    phone: ''
  })

  // Step 2: 관리자 정보
  const [adminInfo, setAdminInfo] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  // Step 3: 기본 설정
  const [basicSettings, setBasicSettings] = useState({
    weekBusinessDays: 6,
    defaultWorkDays: 4,
    maxWeeklyOffs: 2
  })

  const totalSteps = 3
  const progress = (step / totalSteps) * 100

  const handleNext = () => {
    if (step === 1) {
      if (!clinicInfo.name || !clinicInfo.phone) {
        alert('클리닉 정보를 모두 입력해주세요.')
        return
      }
    } else if (step === 2) {
      if (!adminInfo.name || !adminInfo.email || !adminInfo.password) {
        alert('관리자 정보를 모두 입력해주세요.')
        return
      }
      if (adminInfo.password !== adminInfo.confirmPassword) {
        alert('비밀번호가 일치하지 않습니다.')
        return
      }
      if (adminInfo.password.length < 8) {
        alert('비밀번호는 8자 이상이어야 합니다.')
        return
      }
    }
    setStep(step + 1)
  }

  const handlePrev = () => {
    setStep(step - 1)
  }

  const handleComplete = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/setup/initial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic: clinicInfo,
          admin: {
            name: adminInfo.name,
            email: adminInfo.email,
            password: adminInfo.password
          },
          settings: basicSettings
        })
      })

      if (response.ok) {
        alert('초기 설정이 완료되었습니다!')
        router.push('/login')
      } else {
        const result = await response.json()
        alert(result.error || '설정 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('Setup error:', error)
      alert('설정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">연세바로치과 스케줄러</h1>
          <p className="text-gray-600">초기 설정을 진행합니다</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>
                Step {step} / {totalSteps}
              </CardTitle>
              <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </CardHeader>

          <CardContent>
            {/* Step 1: 클리닉 정보 */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">클리닉 정보</h2>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    클리닉 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={clinicInfo.name}
                    onChange={(e) => setClinicInfo({ ...clinicInfo, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="예: 연세바로치과"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">주소</label>
                  <input
                    type="text"
                    value={clinicInfo.address}
                    onChange={(e) => setClinicInfo({ ...clinicInfo, address: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="예: 서울시 강남구 테헤란로 123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    전화번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={clinicInfo.phone}
                    onChange={(e) => setClinicInfo({ ...clinicInfo, phone: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="예: 02-1234-5678"
                  />
                </div>
              </div>
            )}

            {/* Step 2: 관리자 정보 */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">관리자 계정</h2>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={adminInfo.name}
                    onChange={(e) => setAdminInfo({ ...adminInfo, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="관리자 이름"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={adminInfo.email}
                    onChange={(e) => setAdminInfo({ ...adminInfo, email: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={adminInfo.password}
                    onChange={(e) => setAdminInfo({ ...adminInfo, password: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="8자 이상"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    비밀번호 확인 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={adminInfo.confirmPassword}
                    onChange={(e) => setAdminInfo({ ...adminInfo, confirmPassword: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    placeholder="비밀번호 재입력"
                  />
                </div>
              </div>
            )}

            {/* Step 3: 기본 설정 */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold mb-4">기본 설정</h2>
                <div>
                  <label className="block text-sm font-medium mb-2">주 영업일</label>
                  <select
                    value={basicSettings.weekBusinessDays}
                    onChange={(e) =>
                      setBasicSettings({ ...basicSettings, weekBusinessDays: parseInt(e.target.value) })
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value={5}>5일 (월~금)</option>
                    <option value={6}>6일 (월~토)</option>
                    <option value={7}>7일 (매일)</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">클리닉이 운영되는 주당 일수입니다.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">기본 근무일</label>
                  <select
                    value={basicSettings.defaultWorkDays}
                    onChange={(e) =>
                      setBasicSettings({ ...basicSettings, defaultWorkDays: parseInt(e.target.value) })
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value={4}>주 4일</option>
                    <option value={5}>주 5일</option>
                    <option value={6}>주 6일</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">신규 직원의 기본 근무 일수입니다.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">주 최대 오프 횟수</label>
                  <select
                    value={basicSettings.maxWeeklyOffs}
                    onChange={(e) =>
                      setBasicSettings({ ...basicSettings, maxWeeklyOffs: parseInt(e.target.value) })
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value={1}>1회</option>
                    <option value={2}>2회</option>
                    <option value={3}>3회</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">한 주에 최대로 신청 가능한 오프 횟수입니다.</p>
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={handlePrev} disabled={step === 1}>
                이전
              </Button>
              {step < totalSteps ? (
                <Button onClick={handleNext}>다음</Button>
              ) : (
                <Button onClick={handleComplete} disabled={loading}>
                  {loading ? '설정 중...' : '완료'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
