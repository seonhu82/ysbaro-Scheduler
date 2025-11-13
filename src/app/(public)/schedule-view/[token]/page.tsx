/**
 * 스케줄 조회 공개 페이지
 * 경로: /schedule-view/[token]
 *
 * 기능:
 * - 토큰 기반 스케줄 조회
 * - 월별 캘린더 뷰
 * - 개인 뷰: 근무/연차/오프만 표시
 * - 전체 뷰: 원장 패턴 + 근무 인원, 클릭 시 명단 팝업
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Users, RefreshCw, LogOut, FileText, TrendingUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ScheduleAuth } from './auth'
import { MonthNavigator } from '@/components/calendar/MonthNavigator'
import { PublicCalendarGrid } from './PublicCalendarGrid'
import { StaffListPopup } from './StaffListPopup'

interface StaffAssignment {
  staff: {
    id: string
    name: string
    rank: string
  }
  hasNightShift: boolean
  leaveType?: 'ANNUAL' | 'OFF' | null
  leaveStatus?: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | null
}

interface PublicDaySchedule {
  isHoliday: boolean
  holidayName?: string | null
  assignments: StaffAssignment[]
  combinationName?: string
  requiredStaff?: number
}

interface ScheduleData {
  [date: string]: PublicDaySchedule
}

export default function ScheduleViewPage({
  params,
}: {
  params: { token: string }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rawData, setRawData] = useState<any>(null)
  const [scheduleData, setScheduleData] = useState<ScheduleData>({})
  const [clinicName, setClinicName] = useState<string>('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'all' | 'personal'>('personal')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authenticatedStaffId, setAuthenticatedStaffId] = useState<string | null>(null)
  const [authenticatedStaffName, setAuthenticatedStaffName] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<PublicDaySchedule | null>(null)
  const [isPopupOpen, setIsPopupOpen] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  useEffect(() => {
    // sessionStorage에서 인증 정보 확인
    const authData = sessionStorage.getItem(`schedule-auth-${params.token}`)
    if (authData) {
      const { staffId, staffName } = JSON.parse(authData)
      setAuthenticatedStaffId(staffId)
      setAuthenticatedStaffName(staffName)
      setViewMode('personal')
      setIsAuthenticated(true)
    }
  }, [params.token])

  useEffect(() => {
    if (isAuthenticated) {
      fetchSchedule()
    }
  }, [year, month, isAuthenticated])

  // viewMode 변경 시 데이터 재변환
  useEffect(() => {
    if (rawData) {
      transformScheduleData(rawData)
    }
  }, [viewMode, rawData])

  const handleAuthSuccess = (staffId: string, staffName: string) => {
    setAuthenticatedStaffId(staffId)
    setAuthenticatedStaffName(staffName)
    setViewMode('personal')
    setIsAuthenticated(true)

    // sessionStorage에 인증 정보 저장 (다른 페이지에서 사용)
    sessionStorage.setItem(`schedule-auth-${params.token}`, JSON.stringify({
      staffId,
      staffName
    }))

    toast({
      title: '인증 성공',
      description: `${staffName}님의 스케줄을 조회합니다`
    })
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setAuthenticatedStaffId(null)
    setAuthenticatedStaffName(null)
    setViewMode('personal')
    // sessionStorage에서 인증 정보 삭제
    sessionStorage.removeItem(`schedule-auth-${params.token}`)
  }

  const transformScheduleData = (data: any) => {
    const formattedData: ScheduleData = {}

    if (data.clinicName) {
      setClinicName(data.clinicName)
    }

    data.days.forEach((day: any) => {
      formattedData[day.date] = {
        isHoliday: day.isHoliday,
        holidayName: day.holidayName,
        assignments: day.assignments,
        combinationName: day.combinationName, // API에서 받은 조합명 사용
        requiredStaff: 0,
      }
    })

    setScheduleData(formattedData)
  }

  const fetchSchedule = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/public/schedule-view/${params.token}?year=${year}&month=${month}`
      )
      const result = await response.json()

      if (result.success) {
        setRawData(result.data)
        transformScheduleData(result.data)
      } else {
        toast({
          variant: 'destructive',
          title: '조회 실패',
          description: result.error || '스케줄을 불러올 수 없습니다'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleDateClick = (date: Date, schedule: PublicDaySchedule) => {
    // 전체 보기 모드에서만 클릭 가능
    if (viewMode === 'all') {
      setSelectedDate(date)
      setSelectedSchedule(schedule)
      setIsPopupOpen(true)
    }
  }

  // 인증되지 않았으면 인증 화면 표시
  if (!isAuthenticated) {
    return <ScheduleAuth token={params.token} onAuthSuccess={handleAuthSuccess} />
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 animate-spin text-blue-500" />
          <p className="text-gray-500">스케줄 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold">근무 스케줄</h1>
          </div>
          <div className="flex items-center gap-4">
            {authenticatedStaffName && (
              <div className="text-right">
                <p className="text-sm text-gray-600">로그인</p>
                <p className="font-semibold text-blue-600">{authenticatedStaffName}</p>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>
        {clinicName && (
          <p className="text-gray-600">{clinicName}</p>
        )}
      </div>

      {/* 뷰 모드 선택 및 메뉴 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'personal' ? 'default' : 'outline'}
                onClick={() => setViewMode('personal')}
              >
                내 스케줄
              </Button>
              <Button
                variant={viewMode === 'all' ? 'default' : 'outline'}
                onClick={() => setViewMode('all')}
              >
                <Users className="w-4 h-4 mr-2" />
                전체 보기
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/schedule-view/${params.token}/my-leaves`)}
                className="flex-1"
              >
                <FileText className="w-4 h-4 mr-2" />
                신청 내역
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/schedule-view/${params.token}/my-fairness`)}
                className="flex-1"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                형평성 점수
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 캘린더 */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <MonthNavigator
              year={year}
              month={month}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onToday={handleToday}
            />
          </div>
        </div>

        <PublicCalendarGrid
          year={year}
          month={month}
          scheduleData={scheduleData}
          viewMode={viewMode}
          authenticatedStaffId={authenticatedStaffId}
          onDateClick={handleDateClick}
        />
      </div>

      {/* 근무자 명단 팝업 */}
      <StaffListPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        date={selectedDate}
        assignments={selectedSchedule?.assignments || []}
        isHoliday={selectedSchedule?.isHoliday}
        holidayName={selectedSchedule?.holidayName}
      />
    </div>
  )
}
