'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Users, TrendingUp, AlertCircle } from 'lucide-react'

interface SlotData {
  date: string
  total: number
  used: number
  available: number
  weeklyOff: number
}

interface RealTimeStatusProps {
  token: string
  selectedDate?: Date
}

export function RealTimeStatus({ token, selectedDate }: RealTimeStatusProps) {
  const [slots, setSlots] = useState<SlotData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // 초기 데이터 로드
    const fetchInitialData = async () => {
      try {
        const response = await fetch(`/api/leave-apply/${token}/status`)
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setSlots(data.data.slots || [])
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInitialData()

    // SSE 연결 (옵션: 실시간 업데이트가 필요한 경우)
    // const eventSource = new EventSource(`/api/leave-apply/${token}/status/sse`)

    // eventSource.onopen = () => {
    //   setIsConnected(true)
    // }

    // eventSource.onmessage = (event) => {
    //   try {
    //     const data = JSON.parse(event.data)
    //     setSlots(data.slots || [])
    //     setLastUpdate(new Date())
    //   } catch (error) {
    //     console.error('Failed to parse SSE data:', error)
    //   }
    // }

    // eventSource.onerror = () => {
    //   setIsConnected(false)
    //   eventSource.close()
    // }

    // return () => {
    //   eventSource.close()
    // }

    // 폴링 방식 (3초마다)
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/leave-apply/${token}/status`)
        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            setSlots(data.data.slots || [])
            setLastUpdate(new Date())
            setIsConnected(true)
          }
        }
      } catch (error) {
        setIsConnected(false)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [token])

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">로딩 중...</span>
        </div>
      </Card>
    )
  }

  // 선택된 날짜의 슬롯 정보
  const selectedSlot = selectedDate
    ? slots.find(
        (s) =>
          s.date ===
          selectedDate.toISOString().split('T')[0]
      )
    : null

  // 전체 통계
  const totalSlots = slots.reduce((sum, s) => sum + s.total, 0)
  const usedSlots = slots.reduce((sum, s) => sum + s.used, 0)
  const availableSlots = slots.reduce((sum, s) => sum + s.available, 0)

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">실시간 현황</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
          <span>
            {lastUpdate.toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* 선택된 날짜 정보 */}
      {selectedSlot && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm font-medium text-blue-900 mb-2">
            선택한 날짜의 현황
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {selectedSlot.available}
              </div>
              <div className="text-xs text-gray-600">신청 가능</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">
                {selectedSlot.used}
              </div>
              <div className="text-xs text-gray-600">신청 완료</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-400">
                {selectedSlot.total}
              </div>
              <div className="text-xs text-gray-600">전체</div>
            </div>
          </div>
          {selectedSlot.weeklyOff > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-200 text-xs text-blue-700">
              이번 주 오프: {selectedSlot.weeklyOff}/2일
            </div>
          )}
        </div>
      )}

      {/* 전체 통계 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium">전체 슬롯</span>
          </div>
          <span className="text-lg font-bold">{totalSlots}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium">신청 가능</span>
          </div>
          <span className="text-lg font-bold text-green-600">
            {availableSlots}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium">신청 완료</span>
          </div>
          <span className="text-lg font-bold text-gray-600">{usedSlots}</span>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        3초마다 자동 업데이트
      </div>
    </Card>
  )
}
