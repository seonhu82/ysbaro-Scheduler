'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface CategorySlot {
  required: number
  available: number
  approved: number
  onHold: number
}

interface DaySlotStatus {
  date: string
  dayOfWeek: number
  requiredStaff: number
  hasNightShift: boolean
  categorySlots: {
    [categoryName: string]: CategorySlot
  }
  totalAvailable: number
  offAssigned: number
  annualAssigned: number
}

export default function SlotsStatusPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [slotData, setSlotData] = useState<DaySlotStatus[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSlotStatus = async () => {
    if (!startDate || !endDate) return

    setLoading(true)

    try {
      // 임시 token - 실제로는 인증된 사용자 정보로 조회
      const token = 'temp_token'
      const response = await fetch(
        `/api/leave-apply/${token}/status?startDate=${startDate}&endDate=${endDate}`
      )

      const data = await response.json()

      if (data.success) {
        setSlotData(data.status)
      }
    } catch (error) {
      console.error('Failed to fetch slot status:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDayName = (dayOfWeek: number) => {
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return days[dayOfWeek]
  }

  const getAvailabilityColor = (available: number, required: number) => {
    const ratio = available / required
    if (ratio >= 0.7) return 'text-green-600'
    if (ratio >= 0.3) return 'text-amber-600'
    return 'text-red-600'
  }

  const getAvailabilityIcon = (available: number, required: number) => {
    const ratio = available / required
    if (ratio >= 0.7) return <TrendingUp className="w-4 h-4" />
    if (ratio >= 0.3) return <Minus className="w-4 h-4" />
    return <TrendingDown className="w-4 h-4" />
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">구분별 슬롯 현황</h1>
        <p className="text-gray-600">
          날짜별 구분별 슬롯 가용 현황을 확인합니다
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">조회 기간 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startDate">시작 날짜</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">종료 날짜</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={fetchSlotStatus} disabled={loading} className="w-full">
                {loading ? '조회 중...' : '조회'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {slotData.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            기간을 선택하고 조회 버튼을 클릭하세요
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {slotData.map((day) => (
            <Card key={day.date}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <div>
                      <div className="font-semibold">
                        {new Date(day.date).toLocaleDateString('ko-KR')} ({getDayName(day.dayOfWeek)})
                      </div>
                      <div className="text-sm text-gray-500">
                        필요 인원: {day.requiredStaff}명
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {day.hasNightShift && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700">
                        야간
                      </Badge>
                    )}
                    <Badge variant={day.totalAvailable > 0 ? 'default' : 'destructive'}>
                      가용: {day.totalAvailable}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(day.categorySlots).map(([category, slot]) => (
                    <div
                      key={category}
                      className="border rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{category}</div>
                        <div className={`flex items-center gap-1 ${getAvailabilityColor(slot.available, slot.required)}`}>
                          {getAvailabilityIcon(slot.available, slot.required)}
                          <span className="text-sm font-semibold">
                            {slot.available}/{slot.required}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex justify-between">
                          <span>승인:</span>
                          <span className="font-medium">{slot.approved}명</span>
                        </div>
                        {slot.onHold > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>보류:</span>
                            <span className="font-medium">{slot.onHold}명</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 mb-1">오프 배정</div>
                    <div className="font-semibold">{day.offAssigned}명</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">연차 배정</div>
                    <div className="font-semibold">{day.annualAssigned}명</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">전체 가용</div>
                    <div className={`font-semibold ${day.totalAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {day.totalAvailable}명
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
