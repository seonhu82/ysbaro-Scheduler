'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'

interface PatternDay {
  dayOfWeek: number
  isWorkday: boolean
  hasNightShift: boolean
}

interface PatternPreviewProps {
  patternName: string
  doctorName?: string
  days: PatternDay[]
}

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토']

export function PatternPreview({ patternName, doctorName, days }: PatternPreviewProps) {
  const workdayCount = days.filter(d => d.isWorkday).length
  const nightShiftCount = days.filter(d => d.hasNightShift).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          {patternName}
        </CardTitle>
        {doctorName && (
          <p className="text-sm text-gray-600">{doctorName}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 통계 */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-gray-600">근무일:</span>
            <span className="font-semibold ml-2">{workdayCount}일</span>
          </div>
          <div>
            <span className="text-gray-600">야간:</span>
            <span className="font-semibold ml-2">{nightShiftCount}일</span>
          </div>
        </div>

        {/* 요일별 표시 */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => (
            <div
              key={day.dayOfWeek}
              className="flex flex-col items-center"
            >
              <div
                className={`w-full aspect-square flex items-center justify-center rounded-lg text-sm font-medium ${
                  day.isWorkday
                    ? day.hasNightShift
                      ? 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                      : 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                }`}
              >
                {DAYS_KR[day.dayOfWeek]}
              </div>
              {day.hasNightShift && (
                <div className="text-xs mt-1">🌙</div>
              )}
            </div>
          ))}
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap gap-3 text-xs pt-2 border-t">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
            <span className="text-gray-600">주간 근무</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div>
            <span className="text-gray-600">야간 근무</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-100 border-2 border-gray-200 rounded"></div>
            <span className="text-gray-600">휴무</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
