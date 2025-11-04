'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Calendar, Plus } from 'lucide-react'

interface CreatePeriodDialogProps {
  open: boolean
  onClose: (created: boolean) => void
}

export function CreatePeriodDialog({ open, onClose }: CreatePeriodDialogProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    expiresAt: '',
    maxSlotsPerDay: 3,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // 유효성 검사
      if (!formData.expiresAt) {
        throw new Error('만료 날짜를 선택해주세요.')
      }

      // 해당 월의 시작일과 종료일 계산
      const startDate = new Date(formData.year, formData.month - 1, 1)
      const endDate = new Date(formData.expiresAt)

      const response = await fetch('/api/leave-management/period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: formData.year,
          month: formData.month,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          maxSlots: formData.maxSlotsPerDay,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '생성 완료',
          description: `${formData.year}년 ${formData.month}월 신청 기간이 생성되었습니다.`,
        })
        onClose(true)
        // 폼 초기화
        setFormData({
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          expiresAt: '',
          maxSlotsPerDay: 3,
        })
      } else {
        throw new Error(result.error || '생성 실패')
      }
    } catch (error: any) {
      toast({
        title: '생성 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            신청 기간 생성
          </DialogTitle>
          <DialogDescription>
            새로운 연차/오프 신청 기간을 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* 년도 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">
                  년도 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) =>
                    setFormData({ ...formData, year: parseInt(e.target.value) })
                  }
                  min={2020}
                  max={2030}
                  required
                />
              </div>

              {/* 월 */}
              <div>
                <Label htmlFor="month">
                  월 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="month"
                  type="number"
                  value={formData.month}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      month: parseInt(e.target.value),
                    })
                  }
                  min={1}
                  max={12}
                  required
                />
              </div>
            </div>

            {/* 만료 날짜 */}
            <div>
              <Label htmlFor="expiresAt">
                신청 만료 날짜 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiresAt: e.target.value })
                }
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                이 날짜 이후에는 직원들이 신청할 수 없습니다.
              </p>
            </div>

            {/* 일일 슬롯 수 */}
            <div>
              <Label htmlFor="maxSlotsPerDay">
                연차 최대 신청 인원 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="maxSlotsPerDay"
                type="number"
                value={formData.maxSlotsPerDay}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxSlotsPerDay: parseInt(e.target.value),
                  })
                }
                min={1}
                max={10}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                하루에 최대 몇 명까지 연차를 신청할 수 있는지 설정합니다. (오프는 제외)
              </p>
            </div>

            {/* 안내 */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>자동 생성:</strong> 선택한 월의 모든 근무일에 대해
                슬롯이 자동으로 생성됩니다. 설정에서 설정한 휴무일은 자동으로 제외됩니다.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
