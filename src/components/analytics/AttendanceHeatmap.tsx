'use client'

import { useMemo } from 'react'

interface HeatmapData {
  hourlyByDay: {
    [day: string]: { [hour: string]: number }
  }
  metadata: {
    maxValue: number
    avgValue: number
  }
}

interface AttendanceHeatmapProps {
  data: HeatmapData
  title?: string
  height?: number
}

export function AttendanceHeatmap({ data, title = '시간대별 출근 히트맵', height = 400 }: AttendanceHeatmapProps) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const dayLabels: Record<string, string> = {
    monday: '월',
    tuesday: '화',
    wednesday: '수',
    thursday: '목',
    friday: '금',
    saturday: '토',
    sunday: '일',
  }

  // Generate hours array (6 AM to 10 PM)
  const hours = useMemo(() => {
    return Array.from({ length: 17 }, (_, i) => String(i + 6).padStart(2, '0'))
  }, [])

  // Calculate color intensity based on value
  const getColor = (value: number): string => {
    if (value === 0) return 'rgb(241, 245, 249)' // slate-100
    const intensity = Math.min(value / data.metadata.maxValue, 1)

    // Color scale from light blue to dark blue
    const r = Math.round(219 - intensity * 135) // 219 (light) to 59 (dark)
    const g = Math.round(234 - intensity * 104) // 234 to 130
    const b = Math.round(254 - intensity * 48) // 254 to 202

    return `rgb(${r}, ${g}, ${b})`
  }

  // Get cell size based on container
  const cellWidth = 50
  const cellHeight = 40

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>최대: {data.metadata.maxValue}회</span>
          <span>·</span>
          <span>평균: {data.metadata.avgValue.toFixed(1)}회</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Heatmap grid */}
          <div className="flex">
            {/* Y-axis labels (days) */}
            <div className="flex flex-col">
              <div style={{ height: cellHeight }} /> {/* Spacer for x-axis labels */}
              {days.map((day) => (
                <div
                  key={day}
                  className="flex items-center justify-end pr-2 font-medium text-sm"
                  style={{ height: cellHeight }}
                >
                  {dayLabels[day]}
                </div>
              ))}
            </div>

            {/* Heatmap cells */}
            <div className="flex flex-col">
              {/* X-axis labels (hours) */}
              <div className="flex">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="flex items-center justify-center text-xs font-medium"
                    style={{ width: cellWidth, height: cellHeight }}
                  >
                    {hour}시
                  </div>
                ))}
              </div>

              {/* Data cells */}
              {days.map((day) => (
                <div key={day} className="flex">
                  {hours.map((hour) => {
                    const value = data.hourlyByDay[day]?.[hour] || 0
                    const color = getColor(value)

                    return (
                      <div
                        key={`${day}-${hour}`}
                        className="border border-gray-200 flex items-center justify-center text-xs font-medium transition-all hover:border-gray-400 hover:z-10 cursor-pointer relative group"
                        style={{
                          width: cellWidth,
                          height: cellHeight,
                          backgroundColor: color,
                        }}
                        title={`${dayLabels[day]}요일 ${hour}시: ${value}회`}
                      >
                        {value > 0 && (
                          <span
                            className={
                              value / data.metadata.maxValue > 0.5
                                ? 'text-white'
                                : 'text-gray-700'
                            }
                          >
                            {value}
                          </span>
                        )}

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                          <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                            {dayLabels[day]}요일 {hour}시: {value}회
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">출근 빈도:</span>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 border border-gray-200" style={{ backgroundColor: 'rgb(241, 245, 249)' }} />
              <span className="text-xs">0</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 border border-gray-200" style={{ backgroundColor: getColor(data.metadata.maxValue * 0.25) }} />
              <span className="text-xs">낮음</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 border border-gray-200" style={{ backgroundColor: getColor(data.metadata.maxValue * 0.5) }} />
              <span className="text-xs">중간</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 border border-gray-200" style={{ backgroundColor: getColor(data.metadata.maxValue * 0.75) }} />
              <span className="text-xs">높음</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 border border-gray-200" style={{ backgroundColor: getColor(data.metadata.maxValue) }} />
              <span className="text-xs">최대</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
