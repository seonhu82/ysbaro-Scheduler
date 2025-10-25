'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sparkles, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAutoAssign } from '@/lib/hooks/use-auto-assign'

interface AutoAssignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'daily' | 'weekly'
  slotId?: string
  startDate?: string
}

export function AutoAssignModal({
  open,
  onOpenChange,
  mode,
  slotId,
  startDate
}: AutoAssignModalProps) {
  const { assignDaily, assignWeekly, isDailyAssigning, isWeeklyAssigning } =
    useAutoAssign()

  const [options, setOptions] = useState({
    considerFairness: true,
    balanceWorkload: true,
    respectPreferences: false
  })

  const handleAssign = () => {
    if (mode === 'daily' && slotId) {
      assignDaily(slotId, {
        onSuccess: (result) => {
          if (result.success) {
            alert(
              `자동 배치 완료\n성공: ${result.assignments.length}건\n오류: ${result.errors.length}건`
            )
            onOpenChange(false)
          } else {
            alert(`자동 배치 실패\n${result.errors.join('\n')}`)
          }
        }
      })
    } else if (mode === 'weekly' && startDate) {
      assignWeekly(startDate, {
        onSuccess: (result) => {
          if (result.success) {
            alert(
              `주간 자동 배치 완료\n성공: ${result.assignments.length}건\n오류: ${result.errors.length}건`
            )
            onOpenChange(false)
          } else {
            alert(`주간 자동 배치 실패\n${result.errors.join('\n')}`)
          }
        }
      })
    }
  }

  const isAssigning = isDailyAssigning || isWeeklyAssigning

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {mode === 'daily' ? '일별' : '주간'} 자동 배치
          </DialogTitle>
          <DialogDescription>
            {mode === 'daily'
              ? '선택한 날짜의 스케줄을 자동으로 배치합니다'
              : '선택한 주의 모든 스케줄을 자동으로 배치합니다'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 배치 옵션 */}
          <div className="space-y-4">
            <h3 className="font-semibold">배치 옵션</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium">형평성 고려</Label>
                  <p className="text-sm text-gray-600">
                    야간/주말 근무 형평성을 고려하여 배치합니다
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={options.considerFairness}
                  onChange={(e) =>
                    setOptions({ ...options, considerFairness: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium">업무 균형</Label>
                  <p className="text-sm text-gray-600">
                    직원별 총 근무일을 균형있게 배분합니다
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={options.balanceWorkload}
                  onChange={(e) =>
                    setOptions({ ...options, balanceWorkload: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium">선호도 반영</Label>
                  <p className="text-sm text-gray-600">
                    직원의 근무 선호도를 반영합니다 (베타)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={options.respectPreferences}
                  onChange={(e) =>
                    setOptions({ ...options, respectPreferences: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </div>
            </div>
          </div>

          {/* 안내 사항 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">자동 배치 안내</p>
                <ul className="space-y-1 text-blue-800">
                  <li>• 기존 배치는 유지되며, 빈 슬롯만 채웁니다</li>
                  <li>• 연차 사용 현황을 고려합니다</li>
                  <li>• 최대 연속 근무일을 준수합니다</li>
                  {mode === 'weekly' && (
                    <li>• 주 단위로 형평성을 계산합니다</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
          >
            취소
          </Button>
          <Button onClick={handleAssign} disabled={isAssigning}>
            <Sparkles className="w-4 h-4 mr-2" />
            {isAssigning ? '배치 중...' : '자동 배치 시작'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
