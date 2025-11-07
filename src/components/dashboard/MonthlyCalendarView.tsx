/**
 * 월간 캘린더 뷰 컴포넌트
 * - 한 달 전체를 그리드 형태로 표시
 * - 각 날짜 셀: 원장 조합, 야간진료 아이콘, 필요 인력, 연차/오프 신청 수
 * - 클릭 시 상세 모달
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Users,
  Calendar as CalendarIcon,
  FileText,
  Edit
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import DailyScheduleDetailModal from './DailyScheduleDetailModal'

interface DayScheduleData {
  date: Date
  doctorCombination: string[] // 원장 이름 배열
  hasNightShift: boolean
  requiredStaff: { [category: string]: number } // 카테고리별 필요 인력
  leaves: {
    annual: number // 연차 신청 수
    off: number // 오프 신청 수
  }
  isHoliday: boolean
  holidayName?: string
  hasSchedule: boolean // 스케줄이 배정되었는지
}

export default function MonthlyCalendarView() {
  const router = useRouter()
  const { toast } = useToast()

  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [scheduleData, setScheduleData] = useState<DayScheduleData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)

  // Initialize date only on client-side to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
    setCurrentDate(new Date())
  }, [])

  useEffect(() => {
    if (currentDate) {
      fetchMonthSchedule()
    }
  }, [currentDate])

  const fetchMonthSchedule = async () => {
    if (!currentDate) return
    try {
      setLoading(true)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1

      const response = await fetch(`/api/schedule/monthly-view?year=${year}&month=${month}`)
      const data = await response.json()

      if (data.success && data.scheduleData) {
        // scheduleData 객체를 DayScheduleData 배열로 변환
        const days: DayScheduleData[] = []
        const start = startOfMonth(currentDate)
        const end = endOfMonth(currentDate)
        const allDays = eachDayOfInterval({ start, end })

        // API 응답 디버그
        console.log('📅 API scheduleData keys:', Object.keys(data.scheduleData).length)
        const holidayDates = Object.keys(data.scheduleData).filter(k => data.scheduleData[k].holidayName)
        if (holidayDates.length > 0) {
          console.log('📅 API에서 받은 공휴일:', holidayDates.map(k => `${k}:${data.scheduleData[k].holidayName}`).join(', '))
        } else {
          console.log('⚠️ API에서 공휴일 데이터를 받지 못함')
        }

        allDays.forEach(day => {
          const dateKey = day.toISOString().split('T')[0]
          const schedule = data.scheduleData[dateKey]

          if (schedule) {
            const dayData = {
              date: day,
              doctorCombination: schedule.doctorShortNames || [],
              hasNightShift: schedule.hasNightShift || false,
              requiredStaff: {}, // 필요하면 나중에 추가
              leaves: {
                annual: schedule.annualLeaveCount || 0,
                off: schedule.offCount || 0
              },
              isHoliday: schedule.isHoliday || false,
              holidayName: schedule.holidayName || undefined,
              hasSchedule: schedule.doctorShortNames?.length > 0 || false
            }

            // 공휴일 디버그
            if (schedule.holidayName) {
              console.log(`📅 ${dateKey}: holidayName=${schedule.holidayName}`)
            }

            days.push(dayData)
          } else {
            days.push({
              date: day,
              doctorCombination: [],
              hasNightShift: false,
              requiredStaff: {},
              leaves: { annual: 0, off: 0 },
              isHoliday: false,
              hasSchedule: false
            })
          }
        })

        setScheduleData(days)
      } else {
        toast({
          variant: 'destructive',
          title: '스케줄 로드 실패',
          description: data.error || '월간 스케줄을 불러올 수 없습니다'
        })
      }
    } catch (error) {
      console.error('Failed to fetch monthly schedule:', error)
      toast({
        variant: 'destructive',
        title: '오류',
        description: '스케줄을 불러오는 중 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Don't render calendar until mounted on client
  if (!mounted || !currentDate) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-500">캘린더 로딩 중...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 달력 그리기: 이번 달의 모든 날짜 + 앞뒤 빈 칸
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // 첫 주 시작 요일 (0=일, 1=월, ...)
  const startDayOfWeek = getDay(monthStart)

  // 빈 칸 생성
  const leadingEmptyDays = Array.from({ length: startDayOfWeek }, (_, i) => i)

  const renderDayCell = (day: Date) => {
    const dayData = scheduleData.find(
      d => new Date(d.date).toDateString() === day.toDateString()
    )

    if (!dayData) {
      // 데이터 없음 (로딩 중이거나 스케줄 미배정)
      return (
        <div className="min-h-[120px] border border-gray-200 bg-gray-50 p-2">
          <div className="text-sm text-gray-400">{format(day, 'd', { locale: ko })}</div>
        </div>
      )
    }

    const isToday = new Date().toDateString() === day.toDateString()

    return (
      <div
        className={`min-h-[120px] border border-gray-200 p-2 cursor-pointer hover:bg-blue-50 transition-colors ${
          isToday ? 'bg-blue-100 border-blue-400' : dayData.holidayName ? 'bg-red-50' : 'bg-white'
        }`}
        onClick={() => setSelectedDate(day)}
      >
        {/* 날짜 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-sm font-semibold ${
              isToday ? 'text-blue-600' : dayData.holidayName ? 'text-red-600' : 'text-gray-700'
            }`}
          >
            {format(day, 'd', { locale: ko })}
          </span>
          {!dayData.holidayName && dayData.hasNightShift && (
            <Moon className="w-4 h-4 text-indigo-500" title="야간진료" />
          )}
        </div>

        {/* 공휴일 표시 - 공휴일일 경우 다른 정보 숨김 */}
        {dayData.holidayName ? (
          <div className="text-xs text-red-600 font-medium mb-1">{dayData.holidayName}</div>
        ) : (
          <>
            {/* 원장 조합 */}
            {dayData.hasSchedule && dayData.doctorCombination.length > 0 && (
              <div className="text-xs text-gray-600 mb-1 truncate" title={dayData.doctorCombination.join(', ')}>
                👨‍⚕️ {dayData.doctorCombination.join(', ')}
              </div>
            )}

            {/* 필요 인력 */}
            {dayData.hasSchedule && Object.keys(dayData.requiredStaff).length > 0 && (
              <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                <Users className="w-3 h-3" />
                {Object.entries(dayData.requiredStaff)
                  .map(([category, count]) => `${category} ${count}`)
                  .join(', ')}
              </div>
            )}

            {/* 연차/오프 신청 수 */}
            {(dayData.leaves.annual > 0 || dayData.leaves.off > 0) && (
              <div className="flex gap-2 text-xs mt-1">
                {dayData.leaves.annual > 0 && (
                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    연차 {dayData.leaves.annual}
                  </span>
                )}
                {dayData.leaves.off > 0 && (
                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                    오프 {dayData.leaves.off}
                  </span>
                )}
              </div>
            )}

            {/* 스케줄 미배정 */}
            {!dayData.hasSchedule && (
              <div className="text-xs text-gray-400 italic">스케줄 미배정</div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <CalendarIcon className="w-6 h-6" />
                {format(currentDate, 'yyyy년 M월', { locale: ko })}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={goToPrevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  오늘
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(
                    `/schedule/monthly-wizard?year=${currentDate.getFullYear()}&month=${
                      currentDate.getMonth() + 1
                    }`
                  )
                }
              >
                <FileText className="w-4 h-4 mr-2" />
                월간 스케줄 생성
              </Button>
              <Button onClick={() => router.push('/schedule/edit')}>
                <Edit className="w-4 h-4 mr-2" />
                편집
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 캘린더 */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-500">스케줄 로딩 중...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-0">
              {/* 요일 헤더 */}
              {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                <div
                  key={day}
                  className={`text-center text-sm font-semibold py-2 border border-gray-300 ${
                    idx === 0 ? 'text-red-600' : idx === 6 ? 'text-blue-600' : 'text-gray-700'
                  } bg-gray-100`}
                >
                  {day}
                </div>
              ))}

              {/* 빈 칸 (이전 달) */}
              {leadingEmptyDays.map(i => (
                <div key={`empty-${i}`} className="min-h-[120px] border border-gray-200 bg-gray-50"></div>
              ))}

              {/* 날짜 셀 */}
              {daysInMonth.map(day => (
                <div key={day.toISOString()}>{renderDayCell(day)}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상세 모달 */}
      {selectedDate && (
        <DailyScheduleDetailModal
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          onRefresh={fetchMonthSchedule}
        />
      )}
    </div>
  )
}
