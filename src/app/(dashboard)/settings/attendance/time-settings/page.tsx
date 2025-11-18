/**
 * 출퇴근 시간 설정 페이지
 * 경로: /settings/attendance/time-settings
 *
 * 기능:
 * - 요일별 영업시간/출퇴근 시간 설정
 * - 야근 시간 설정
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { Clock, Save, RefreshCw, ArrowLeft } from 'lucide-react'

interface WeekdayTime {
  operatingStart: string
  operatingEnd: string
  workStart: string
  workEnd: string
}

interface NightShiftTime {
  nightShiftStart: string
  nightShiftEnd: string
}

const WEEKDAYS = [
  { value: 'MONDAY', label: '월요일' },
  { value: 'TUESDAY', label: '화요일' },
  { value: 'WEDNESDAY', label: '수요일' },
  { value: 'THURSDAY', label: '목요일' },
  { value: 'FRIDAY', label: '금요일' },
  { value: 'SATURDAY', label: '토요일' },
  { value: 'SUNDAY', label: '일요일' }
]

export default function AttendanceTimeSettingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [weekdayTimes, setWeekdayTimes] = useState<Record<string, WeekdayTime>>({})
  const [nightShiftTime, setNightShiftTime] = useState<NightShiftTime>({
    nightShiftStart: '18:00',
    nightShiftEnd: '21:00'
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/attendance/time-settings')
      const data = await response.json()

      if (data.success) {
        const { settings } = data.data
        setWeekdayTimes(settings.weekdayTimes || {})
        setNightShiftTime(settings.nightShiftTime || {
          nightShiftStart: '18:00',
          nightShiftEnd: '21:00'
        })
      } else {
        toast({
          variant: 'destructive',
          title: '설정 로드 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '설정을 불러오는 중 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const response = await fetch('/api/attendance/time-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekdayTimes,
          nightShiftTime
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '저장 완료',
          description: '출퇴근 시간 설정이 저장되었습니다'
        })
        await fetchSettings()
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '설정 저장 중 오류가 발생했습니다'
      })
    } finally {
      setSaving(false)
    }
  }

  const updateWeekdayTime = (day: string, field: keyof WeekdayTime, value: string) => {
    setWeekdayTimes(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">로딩 중...</span>
      </div>
    )
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
        <h1 className="text-2xl font-bold mb-2">출퇴근 시간 설정</h1>
        <p className="text-gray-600">
          요일별 영업시간/출퇴근 시간과 야근 시간을 설정합니다
        </p>
      </div>

      <div className="mb-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-900">
        <strong>💡 안내:</strong> 각 요일별 시간을 설정하면, 해당 요일의 모든 조합에 자동으로 적용됩니다.
        야근이 있는 조합에는 야근 시간이 추가로 적용됩니다.
      </div>

      <Tabs defaultValue="weekday" className="mb-6">
        <TabsList>
          <TabsTrigger value="weekday">요일별 설정</TabsTrigger>
          <TabsTrigger value="night">야근 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="weekday">
          <Card>
            <CardHeader>
              <CardTitle>요일별 출퇴근 시간</CardTitle>
              <CardDescription>
                각 요일별로 영업시간과 출퇴근 시간을 설정하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {WEEKDAYS.map(({ value, label }) => (
                  <div key={value} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                    <div className="flex items-center font-medium">
                      <Clock className="w-4 h-4 mr-2" />
                      {label}
                    </div>
                    <div>
                      <Label className="text-xs">영업 시작</Label>
                      <Input
                        type="time"
                        value={weekdayTimes[value]?.operatingStart || ''}
                        onChange={(e) => updateWeekdayTime(value, 'operatingStart', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">영업 종료</Label>
                      <Input
                        type="time"
                        value={weekdayTimes[value]?.operatingEnd || ''}
                        onChange={(e) => updateWeekdayTime(value, 'operatingEnd', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">출근 시간</Label>
                      <Input
                        type="time"
                        value={weekdayTimes[value]?.workStart || ''}
                        onChange={(e) => updateWeekdayTime(value, 'workStart', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">퇴근 시간</Label>
                      <Input
                        type="time"
                        value={weekdayTimes[value]?.workEnd || ''}
                        onChange={(e) => updateWeekdayTime(value, 'workEnd', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="night">
          <Card>
            <CardHeader>
              <CardTitle>야근 시간 설정</CardTitle>
              <CardDescription>
                야근 시작/종료 시간을 설정하세요 (hasNightShift=true인 조합에 자동 적용)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-yellow-50 rounded-lg text-sm text-yellow-900 mb-4">
                  <strong>📌 참고:</strong> 야근 시간은 조합 생성 시 "야근 여부"를 체크한 조합에만 적용됩니다.
                  <br />
                  예: 월요일 + 야근 조합 → 월요일 시간 + 야근 시간
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div>
                    <Label>야근 시작 시간</Label>
                    <Input
                      type="time"
                      value={nightShiftTime.nightShiftStart}
                      onChange={(e) =>
                        setNightShiftTime(prev => ({ ...prev, nightShiftStart: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>야근 종료 시간</Label>
                    <Input
                      type="time"
                      value={nightShiftTime.nightShiftEnd}
                      onChange={(e) =>
                        setNightShiftTime(prev => ({ ...prev, nightShiftEnd: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={fetchSettings} disabled={saving}>
          <RefreshCw className="w-4 h-4 mr-2" />
          초기화
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  )
}
