'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, TrendingUp, AlertCircle } from 'lucide-react'

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

interface RealTimeStatusProps {
  token: string
  selectedDate?: Date
  slotStatus: SlotStatus | null
}

export function RealTimeStatus({ token, selectedDate, slotStatus }: RealTimeStatusProps) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    // 데이터가 업데이트되면 마지막 업데이트 시간 갱신
    setLastUpdate(new Date())
  }, [slotStatus])

  if (!slotStatus) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">데이터 로딩 중...</div>
      </Card>
    )
  }

  // 전체 통계
  const totalSlots = slotStatus.totalSlots
  const availableSlots = slotStatus.availableSlots
  const usedSlots = slotStatus.appliedCount

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">실시간 현황</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>
            {lastUpdate.toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* 전체 통계 */}
      <div className="space-y-3">
        {/* 신청 현황 */}
        <div className="border-l-4 border-blue-500 pl-3">
          <div className="text-sm font-semibold text-blue-900 mb-2">신청 현황</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 p-2 rounded">
              <div className="text-xs text-gray-600">오프 (OFF)</div>
              <div className="text-lg font-bold text-blue-900">{slotStatus.appliedOffCount}</div>
            </div>
            <div className="bg-purple-50 p-2 rounded">
              <div className="text-xs text-gray-600">연차 (ANNUAL)</div>
              <div className="text-lg font-bold text-purple-900">{slotStatus.appliedAnnualCount}</div>
            </div>
          </div>
        </div>

        {/* 신청 가능 슬롯 */}
        <div className="border-l-4 border-green-500 pl-3 mt-3">
          <div className="text-sm font-semibold text-green-900 mb-2">신청 가능</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 p-2 rounded">
              <div className="text-xs text-gray-600">오프 (OFF)</div>
              <div className="text-lg font-bold text-green-900">{slotStatus.availableOffSlots}</div>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <div className="text-xs text-gray-600">연차 (ANNUAL)</div>
              <div className="text-lg font-bold text-green-900">{slotStatus.availableAnnualSlots}</div>
            </div>
          </div>
        </div>

        {/* 전체 슬롯 */}
        <div className="border-t pt-3 mt-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium">전체 휴무슬롯</span>
            </div>
            <span className="text-lg font-bold">{totalSlots}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg mt-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium">신청 완료</span>
            </div>
            <span className="text-lg font-bold text-orange-600">
              {usedSlots}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg mt-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">신청 가능 (전체)</span>
            </div>
            <span className="text-lg font-bold text-green-600">
              {availableSlots}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        신청 시 자동 업데이트
      </div>
    </Card>
  )
}
