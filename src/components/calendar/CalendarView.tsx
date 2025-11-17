'use client'

import { useState, useEffect } from 'react'
import { MonthNavigator } from './MonthNavigator'
import { CalendarGrid } from './CalendarGrid'
import { DayDetailPopup } from './DayDetailPopup'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, Share2, MessageCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
// import { PatternApplyButton } from './PatternApplyButton' // 메인 캘린더에서는 미사용

// Updated: Now includes both leave applications and scheduled OFF days

interface Doctor {
  id: string
  name: string
  shortName: string
}

interface DaySchedule {
  combinationName: string
  hasNightShift: boolean
  requiredStaff: number
  assignedStaff: number
  doctorShortNames: string[]
  annualLeaveCount?: number // 연차 인원
  offCount?: number // 오프 인원
  leaveCount?: number // 하위 호환용 (연차+오프 합계)
  holidayName?: string // 공휴일명
}

interface CalendarViewProps {
  onDateClick?: (date: Date) => void
}

export function CalendarView({ onDateClick }: CalendarViewProps) {
  const { toast } = useToast()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [scheduleData, setScheduleData] = useState<Record<string, DaySchedule>>({})
  const [loading, setLoading] = useState(false)
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null)
  const [deploying, setDeploying] = useState(false)
  const [kakaoApiKey, setKakaoApiKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'auto' | 'manual'>('auto')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  // 카카오 API 키 확인
  useEffect(() => {
    const checkKakaoApi = async () => {
      try {
        const response = await fetch('/api/settings/kakao')
        const data = await response.json()
        if (data.success && data.data?.apiKey) {
          setKakaoApiKey(data.data.apiKey)
        }
      } catch (error) {
        console.error('Failed to check Kakao API:', error)
      }
    }
    checkKakaoApi()
  }, [])

  // 스케줄 데이터 로딩
  useEffect(() => {
    const fetchScheduleData = async () => {
      setLoading(true)
      try {
        // monthly-view API 사용 (이미 offCount를 정확하게 계산함)
        const departmentTypeParam = activeTab !== 'all' ? `&departmentType=${activeTab}` : ''
        const response = await fetch(`/api/schedule/monthly-view?year=${year}&month=${month}${departmentTypeParam}`, { cache: 'no-store' })
        const result = await response.json()

        console.log('Monthly-view API response:', result)

        if (result.success && result.scheduleData) {
          // monthly-view API는 이미 완전히 계산된 scheduleData를 반환함
          console.log('Final calendar data:', result.scheduleData)
          setScheduleData(result.scheduleData)
        }
      } catch (error) {
        console.error('Failed to fetch schedule:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchScheduleData()
  }, [year, month, activeTab])

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // 배포 URL 생성 및 복사
  const handleCopyDeployUrl = async () => {
    try {
      setDeploying(true)

      // 배포 링크 생성
      const response = await fetch('/api/deploy/schedule-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, expiryDays: 90 })
      })

      const data = await response.json()

      if (data.success) {
        const url = data.data.publicUrl
        setDeployedUrl(url)

        // 클립보드에 복사
        await navigator.clipboard.writeText(url)

        toast({
          title: 'URL 복사 완료',
          description: `${year}년 ${month}월 스케줄 조회 링크가 복사되었습니다`
        })
      } else {
        toast({
          variant: 'destructive',
          title: '배포 실패',
          description: data.error || '링크 생성에 실패했습니다'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '링크 복사 중 오류가 발생했습니다'
      })
    } finally {
      setDeploying(false)
    }
  }

  // 카카오톡으로 공유
  const handleKakaoShare = async () => {
    if (!kakaoApiKey) {
      toast({
        variant: 'destructive',
        title: '카카오 API 키 필요',
        description: '설정에서 카카오 API 키를 먼저 등록해주세요'
      })
      return
    }

    try {
      // 배포 URL이 없으면 먼저 생성
      let url = deployedUrl
      if (!url) {
        const response = await fetch('/api/deploy/schedule-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, month, expiryDays: 90 })
        })

        const data = await response.json()
        if (data.success) {
          url = data.data.publicUrl
          setDeployedUrl(url)
        } else {
          throw new Error('Failed to create deployment link')
        }
      }

      // 카카오톡 공유 (Kakao SDK 사용)
      if (typeof window !== 'undefined' && (window as any).Kakao) {
        const Kakao = (window as any).Kakao

        if (!Kakao.isInitialized()) {
          Kakao.init(kakaoApiKey)
        }

        Kakao.Link.sendDefault({
          objectType: 'feed',
          content: {
            title: `${year}년 ${month}월 근무 스케줄`,
            description: '근무 일정을 확인하세요',
            imageUrl: 'https://via.placeholder.com/400x300.png?text=Schedule',
            link: {
              mobileWebUrl: url,
              webUrl: url
            }
          },
          buttons: [
            {
              title: '스케줄 보기',
              link: {
                mobileWebUrl: url,
                webUrl: url
              }
            }
          ]
        })

        toast({
          title: '카카오톡 공유',
          description: '카카오톡 공유창이 열립니다'
        })
      } else {
        toast({
          variant: 'destructive',
          title: '카카오톡 SDK 로드 실패',
          description: '카카오톡 공유 기능을 사용할 수 없습니다'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '공유 실패',
        description: '카카오톡 공유 중 오류가 발생했습니다'
      })
    }
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setIsPopupOpen(true)
    onDateClick?.(date)
  }

  const handleClosePopup = () => {
    setIsPopupOpen(false)
    setSelectedDate(null)
  }

  const handleSaveSchedule = async (schedule: any) => {
    try {
      const response = await fetch('/api/schedule/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule)
      })

      if (response.ok) {
        // 저장 후 스케줄 데이터 새로고침
        const refreshResponse = await fetch(`/api/schedule?year=${year}&month=${month}`)
        const result = await refreshResponse.json()
        if (result.success && result.data) {
          // 데이터 업데이트 로직 재실행
          const data: Record<string, { doctors: Doctor[]; staffCount: number }> = {}
          // ... 위와 동일한 변환 로직
          setScheduleData(data)
        }
      }
    } catch (error) {
      console.error('Failed to save schedule:', error)
      throw error
    }
  }

  // handleApplyPattern 함수 제거 (메인 캘린더에서는 미사용)

  return (
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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'auto' | 'manual')} className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="auto">자동 배치 부서</TabsTrigger>
          <TabsTrigger value="manual">수동 배치 부서</TabsTrigger>
          <TabsTrigger value="all">전체</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      )}

      {!loading && (
        <>
          <CalendarGrid
            year={year}
            month={month}
            scheduleData={scheduleData}
            onDateClick={handleDateClick}
            filterType={activeTab}
          />

          <DayDetailPopup
            date={selectedDate}
            isOpen={isPopupOpen}
            onClose={handleClosePopup}
            onSave={handleSaveSchedule}
            year={year}
            month={month}
            departmentFilter={activeTab}
          />

          {/* 배포 버튼 - 하단 */}
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-semibold">스케줄 공유</p>
                    <p className="text-sm text-gray-600">
                      {year}년 {month}월 스케줄을 직원들과 공유하세요
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <Button
                    onClick={handleCopyDeployUrl}
                    disabled={deploying}
                    variant="outline"
                    className="flex-1 md:flex-none"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {deploying ? '생성 중...' : 'URL 복사'}
                  </Button>
                  {kakaoApiKey && (
                    <Button
                      onClick={handleKakaoShare}
                      disabled={deploying}
                      className="flex-1 md:flex-none bg-yellow-400 hover:bg-yellow-500 text-gray-900"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      카카오톡 공유
                    </Button>
                  )}
                </div>
              </div>
              {deployedUrl && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">배포된 URL</p>
                  <p className="text-sm font-mono text-blue-600 break-all">{deployedUrl}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
