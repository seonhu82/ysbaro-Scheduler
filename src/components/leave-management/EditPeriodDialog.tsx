'use client'

import { useState, useEffect } from 'react'
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
import { Calendar } from 'lucide-react'

interface EditPeriodDialogProps {
  open: boolean
  onClose: (updated: boolean) => void
  period: {
    id: string
    year: number
    month: number
    expiresAt: string
  } | null
}

export function EditPeriodDialog({ open, onClose, period }: EditPeriodDialogProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    if (period && open) {
      // expiresAt을 datetime-local 형식으로 변환
      const date = new Date(period.expiresAt)
      const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      setExpiresAt(localDateTime)
    }
  }, [period, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!period) return

    setSubmitting(true)

    try {
      if (!expiresAt) {
        throw new Error('만료 날짜를 선택해주세요.')
      }

      const response = await fetch(`/api/leave-management/period/${period.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '수정 완료',
          description: `${period.year}년 ${period.month}월 신청 기간이 수정되었습니다.`,
        })
        onClose(true)
      } else {
        throw new Error(result.error || '수정 실패')
      }
    } catch (error: any) {
      toast({
        title: '수정 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!period) return null

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            신청 기간 수정
          </DialogTitle>
          <DialogDescription>
            {period.year}년 {period.month}월 신청 기간을 수정합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* 년/월 표시 (수정 불가) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>년도</Label>
                <Input value={period.year} disabled />
              </div>
              <div>
                <Label>월</Label>
                <Input value={period.month} disabled />
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
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                이 날짜 이후에는 직원들이 신청할 수 없습니다.
              </p>
            </div>

            {/* 안내 */}
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-900">
                <strong>주의:</strong> 이미 접수된 신청은 영향을 받지 않습니다.
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
              {submitting ? '수정 중...' : '수정'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
