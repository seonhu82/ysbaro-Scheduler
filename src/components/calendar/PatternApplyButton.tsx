'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Calendar, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PatternApplyButtonProps {
  onApply?: (year: number, month: number) => Promise<void>
}

export function PatternApplyButton({ onApply }: PatternApplyButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const currentDate = new Date()
  const [year, setYear] = useState(currentDate.getFullYear())
  const [month, setMonth] = useState(currentDate.getMonth() + 1)

  const handleApply = async () => {
    try {
      setLoading(true)

      if (onApply) {
        await onApply(year, month)
      } else {
        // API 호출
        const response = await fetch('/api/doctor-pattern/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, month }),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || '패턴 적용 실패')
        }
      }

      toast({
        title: '패턴 적용 완료',
        description: `${year}년 ${month}월에 원장 패턴이 적용되었습니다.`,
      })

      setIsOpen(false)
    } catch (error) {
      console.error('Failed to apply pattern:', error)
      toast({
        title: '패턴 적용 실패',
        description: '패턴 적용 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="w-4 h-4 mr-1" />
          패턴 적용
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            원장 패턴 적용
          </DialogTitle>
          <DialogDescription>
            설정된 요일별 패턴을 선택한 월에 일괄 적용합니다
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">연도</Label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">월</Label>
              <select
                id="month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-900">
            <p className="font-medium mb-1">안내</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>기존 스케줄이 있는 경우 덮어씌워집니다</li>
              <li>요일별로 설정된 원장 패턴이 적용됩니다</li>
              <li>야간 진료 여부도 함께 적용됩니다</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              취소
            </Button>
            <Button onClick={handleApply} disabled={loading}>
              {loading ? '적용 중...' : '적용하기'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
