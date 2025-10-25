'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Calendar, Play } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PatternApplyButtonProps {
  onApply?: () => void
}

export function PatternApplyButton({ onApply }: PatternApplyButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const handleApply = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/doctor-pattern/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          year,
          month
        })
      })

      const result = await response.json()

      if (result.success) {
        alert(`${result.data.assignmentsCount}개의 원장 배치가 생성되었습니다.`)
        setOpen(false)
        onApply?.()
      } else {
        alert('패턴 적용 실패: ' + result.error)
      }
    } catch (error) {
      console.error('Pattern apply error:', error)
      alert('패턴 적용 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Play className="w-4 h-4 mr-2" />
        패턴 적용
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              원장 패턴 적용
            </DialogTitle>
            <DialogDescription>
              활성화된 원장 패턴을 월간 스케줄에 적용합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="year">연도</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                min={2024}
                max={2030}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">월</Label>
              <Input
                id="month"
                type="number"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                min={1}
                max={12}
              />
            </div>

            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
              <p className="font-semibold mb-1">적용 내용:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>활성화된 모든 원장 패턴을 해당 월에 적용합니다</li>
                <li>기존 원장 배치는 삭제되고 새로 생성됩니다</li>
                <li>휴업일은 자동으로 제외됩니다</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              취소
            </Button>
            <Button onClick={handleApply} disabled={loading}>
              {loading ? '적용 중...' : '적용하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
