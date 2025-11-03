'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import WeeklyPatternBuilder from '@/components/wizard/WeeklyPatternBuilder'
import Link from 'next/link'

export default function AutoAssignPage() {
  const { toast } = useToast()
  const currentDate = new Date()
  const [year, setYear] = useState(currentDate.getFullYear())
  const [month, setMonth] = useState(currentDate.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [weeklyPatterns, setWeeklyPatterns] = useState<{ weekNumber: number; patternId: string }[]>([])
  const [result, setResult] = useState<any>(null)

  // 기존 스케줄 요약 로드
  useEffect(() => {
    const loadScheduleSummary = async () => {
      try {
        const response = await fetch(
          `/api/schedule/doctor-summary?year=${year}&month=${month}`,
          { cache: 'no-store' }
        )
        const data = await response.json()

        if (data.success && data.hasSchedule) {
          // 스케줄이 있으면 result에 요약 정보 채우기
          setResult({
            success: true,
            doctorSchedules: data.doctorSchedules,
            slots: data.slots,
            weekPatterns: data.weekPatterns
          })
        } else {
          // 스케줄이 없으면 result 초기화
          setResult(null)
        }
      } catch (error) {
        console.error('Failed to load schedule summary:', error)
        setResult(null)
      }
    }

    loadScheduleSummary()
  }, [year, month])

  const handlePatternsAssigned = (assignments: { weekNumber: number; patternId: string }[]) => {
    setWeeklyPatterns(assignments)
  }

  const handleApply = async () => {
    // 주간 패턴이 할당되었는지 확인
    if (weeklyPatterns.length === 0) {
      toast({
        variant: 'destructive',
        title: '패턴 배정 필요',
        description: '모든 주에 주간 패턴을 배정해주세요'
      })
      return
    }

    setLoading(true)

    try {
      // weekPatterns를 Record 형식으로 변환
      const weekPatternsRecord = weeklyPatterns.reduce((acc, { weekNumber, patternId }) => {
        acc[weekNumber] = patternId
        return acc
      }, {} as Record<number, string>)

      const response = await fetch('/api/schedule/apply-weekly-pattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          weekPatterns: weekPatternsRecord
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '원장 스케줄 배치 완료',
          description: `${year}년 ${month}월 원장 스케줄이 배치되었습니다`
        })

        // 배치 완료 후 요약 정보 다시 로드
        const summaryResponse = await fetch(`/api/schedule/doctor-summary?year=${year}&month=${month}`)
        const summaryData = await summaryResponse.json()

        if (summaryData.success && summaryData.hasSchedule) {
          setResult({
            success: true,
            doctorSchedules: summaryData.doctorSchedules,
            slots: summaryData.slots,
            weekPatterns: summaryData.weekPatterns,
            results: data.results // 배치 결과도 포함
          })
        }
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({
        title: '스케줄 배치 실패',
        description: error.message || '다시 시도해주세요',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Calendar className="w-8 h-8" />
          원장 스케줄 배치
        </h1>
        <p className="text-gray-600">
          주차별 패턴을 선택하여 월간 원장 스케줄을 자동으로 배치합니다
        </p>
      </div>

      {/* 월 선택 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            월 선택
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">연도</label>
              <Select
                value={year.toString()}
                onValueChange={(value) => setYear(parseInt(value))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(y => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">월</label>
              <Select
                value={month.toString()}
                onValueChange={(value) => setMonth(parseInt(value))}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={m.toString()}>
                      {m}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 주간 패턴 빌더 */}
      <WeeklyPatternBuilder
        year={year}
        month={month}
        onPatternsAssigned={handlePatternsAssigned}
      />

      {/* 배치 버튼 및 결과 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Button
              onClick={handleApply}
              disabled={loading || weeklyPatterns.length === 0}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  배치 중...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  원장 스케줄 배치
                </>
              )}
            </Button>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-sm text-blue-900 mb-2">
                안내사항
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 좌측의 패턴을 드래그하여 주차 영역에 드롭하세요</li>
                <li>• 기존 원장 스케줄이 있는 경우 덮어씌워집니다</li>
                <li>• 각 주차별로 다른 패턴을 적용할 수 있습니다</li>
                <li>• 월요일~일요일 완전한 주 단위로 생성됩니다</li>
              </ul>
            </div>

            {/* 연차/오프 신청 기간 생성 안내 */}
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-emerald-900 mb-2">
                💡 원장 스케줄 배치 완료 후 다음 단계
              </h4>
              <p className="text-sm text-emerald-700 mb-3">
                원장 스케줄 배치가 완료되면 직원들의 <strong>연차/오프 신청 기간</strong>을 생성해주세요.
              </p>
              <ul className="text-sm text-emerald-600 space-y-1 mb-4">
                <li>• 직원들이 연차/오프를 신청할 수 있는 기간을 설정합니다</li>
                <li>• 신청 URL을 생성하여 직원들과 공유할 수 있습니다</li>
                <li>• 신청된 연차/오프는 최종 직원 배치 시 자동으로 반영됩니다</li>
              </ul>
              <Link href="/leave-management">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full">
                  <Calendar className="w-4 h-4" />
                  신청 기간 생성하러 가기
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 오른쪽: 결과 표시 */}
        <Card>
          <CardHeader>
            <CardTitle>스케줄 요약</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center text-gray-500 py-12">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">
                  스케줄 생성을 실행하면<br />결과가 여기에 표시됩니다
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">스케줄 있음</span>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">생성된 기간</div>
                  <div className="text-lg font-bold">{year}년 {month}월</div>
                </div>

                {result.doctorSchedules && result.doctorSchedules.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">원장별 근무 통계</div>
                    {result.doctorSchedules.map((ds: any) => (
                      <div key={ds.doctorName} className="bg-gray-50 rounded p-3 text-sm">
                        <div className="font-medium">{ds.doctorName}</div>
                        <div className="text-gray-600 text-xs mt-1">
                          근무: {ds.totalDays}일 | 야간: {ds.nightShifts}회
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {result.slots && result.slots.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">슬롯 현황</div>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      <div className="text-gray-600">
                        총 {result.slots.length}일 스케줄 생성됨
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        평균 필요 인원: {result.slots.length > 0 ? Math.round(result.slots.reduce((sum: number, s: any) => sum + s.requiredStaff, 0) / result.slots.length) : 0}명
                      </div>
                    </div>
                  </div>
                )}

                {result.results && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">주차별 적용 패턴</div>
                    {result.results.map((r: any) => (
                      <div key={r.week} className="bg-gray-50 rounded p-3 text-sm">
                        <div className="font-medium">{r.week}주차</div>
                        <div className="text-gray-600">{r.patternName}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {r.appliedDates}일 적용
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-900">
                    원장 스케줄이 배치되었습니다.<br />
                    캘린더에서 확인하세요.
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
