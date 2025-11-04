'use client'

import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Calendar, Coffee, AlertCircle } from 'lucide-react'

type LeaveType = 'ANNUAL' | 'OFF'

interface TypeSelectorProps {
  selectedType: LeaveType
  onSelect: (type: LeaveType) => void
  weeklyOffCount?: number
  remainingAnnualDays?: number
}

export function TypeSelector({
  selectedType,
  onSelect,
  weeklyOffCount = 0,
  remainingAnnualDays,
}: TypeSelectorProps) {
  const isOffLimitReached = weeklyOffCount >= 2

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">유형 선택</h3>
        <p className="text-sm text-gray-600">
          연차 또는 오프를 선택해주세요
        </p>
      </div>

      <div className="space-y-3">
        {/* 연차 선택 */}
        <label
          className={`
            flex items-start p-4 rounded-lg border-2 cursor-pointer transition-colors
            ${
              selectedType === 'ANNUAL'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }
          `}
        >
          <input
            type="radio"
            name="leaveType"
            value="ANNUAL"
            checked={selectedType === 'ANNUAL'}
            onChange={() => onSelect('ANNUAL')}
            className="mt-1 mr-3"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-gray-900">연차</span>
            </div>
            <p className="text-sm text-gray-600">
              정규 연차를 사용합니다. 연차 일수에서 차감됩니다.
            </p>
            {remainingAnnualDays !== undefined && (
              <div className="mt-2 text-sm">
                <span className="text-gray-600">남은 연차: </span>
                <span className="font-semibold text-blue-600">{remainingAnnualDays}일</span>
              </div>
            )}
          </div>
        </label>

        {/* 오프 선택 */}
        <label
          className={`
            flex items-start p-4 rounded-lg border-2 cursor-pointer transition-colors
            ${
              selectedType === 'OFF'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }
            ${isOffLimitReached ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            type="radio"
            name="leaveType"
            value="OFF"
            checked={selectedType === 'OFF'}
            onChange={() => !isOffLimitReached && onSelect('OFF')}
            disabled={isOffLimitReached}
            className="mt-1 mr-3"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Coffee className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-gray-900">오프</span>
            </div>
            <p className="text-sm text-gray-600">
              주간 오프입니다. 주 2일까지 신청 가능합니다.
            </p>
            {weeklyOffCount > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                이번 주 오프: {weeklyOffCount}/2일
              </div>
            )}
          </div>
        </label>
      </div>

      {/* 오프 제한 경고 */}
      {isOffLimitReached && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-900">오프 신청 불가</p>
            <p className="text-yellow-700">
              이번 주는 이미 2일의 오프를 신청하셨습니다. 연차로 신청해주세요.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
