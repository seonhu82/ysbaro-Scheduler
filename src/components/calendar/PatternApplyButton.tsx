'use client'

import { useState, useEffect } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface WeeklyPattern {
  id: string
  name: string
  description?: string
  isDefault: boolean
}

interface PatternApplyButtonProps {
  onApply?: (year: number, month: number) => Promise<void>
}

export function PatternApplyButton({ onApply }: PatternApplyButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [patterns, setPatterns] = useState<WeeklyPattern[]>([])
  const { toast } = useToast()

  const currentDate = new Date()
  const [year, setYear] = useState(currentDate.getFullYear())
  const [month, setMonth] = useState(currentDate.getMonth() + 1)

  // 주차별 패턴 선택 (1주차부터 5주차까지)
  const [weekPatterns, setWeekPatterns] = useState<Record<number, string>>({
    1: '',
    2: '',
    3: '',
    4: '',
    5: ''
  })

  // 주간 패턴 목록 로드
  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        const response = await fetch('/api/settings/weekly-patterns')
        const result = await response.json()

        if (Array.isArray(result)) {
          setPatterns(result)

          // 기본 패턴이 있으면 모든 주차에 자동 설정
          const defaultPattern = result.find((p: WeeklyPattern) => p.isDefault)
          if (defaultPattern) {
            setWeekPatterns({
              1: defaultPattern.id,
              2: defaultPattern.id,
              3: defaultPattern.id,
              4: defaultPattern.id,
              5: defaultPattern.id
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch patterns:', error)
      }
    }

    if (isOpen) {
      fetchPatterns()
    }
  }, [isOpen])

  const handleApply = async () => {
    try {
      setLoading(true)

      // 모든 주차에 패턴이 선택되었는지 확인
      const hasEmptyPattern = Object.values(weekPatterns).some(p => !p)
      if (hasEmptyPattern) {
        toast({
          title: '패턴 선택 필요',
          description: '모든 주차에 패턴을 선택해주세요.',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      if (onApply) {
        await onApply(year, month)
      } else {
        // API 호출 - 주차별 패턴 정보 전달
        const response = await fetch('/api/schedule/apply-weekly-pattern', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year,
            month,
            weekPatterns // { 1: 'patternId1', 2: 'patternId2', ... }
          }),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || '패턴 적용 실패')
        }
      }

      toast({
        title: '패턴 적용 완료',
        description: `${year}년 ${month}월에 주간 패턴이 적용되었습니다.`,
      })

      setIsOpen(false)

      // 페이지 새로고침하여 변경사항 반영
      window.location.reload()
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            주간 패턴 적용
          </DialogTitle>
          <DialogDescription>
            각 주차별로 주간 패턴을 선택하여 월간 스케줄에 적용합니다
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

          <div className="border-t pt-4">
            <Label className="text-base font-semibold mb-3 block">주차별 패턴 선택</Label>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((week) => (
                <div key={week} className="flex items-center gap-4">
                  <Label htmlFor={`week-${week}`} className="w-20 text-sm font-medium">
                    {week}주차
                  </Label>
                  <Select
                    value={weekPatterns[week] || undefined}
                    onValueChange={(value) => setWeekPatterns({ ...weekPatterns, [week]: value })}
                  >
                    <SelectTrigger id={`week-${week}`} className="flex-1">
                      <SelectValue placeholder="패턴 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {patterns.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">등록된 패턴이 없습니다</div>
                      ) : (
                        patterns.map((pattern) => (
                          <SelectItem key={pattern.id} value={pattern.id}>
                            <div className="flex items-center gap-2">
                              <span>{pattern.name}</span>
                              {pattern.isDefault && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                  기본
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-900">
            <p className="font-medium mb-1">안내</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>기존 스케줄이 있는 경우 덮어씌워집니다</li>
              <li>각 주차별로 다른 패턴을 적용할 수 있습니다</li>
              <li>선택한 주간 패턴의 요일별 조합이 자동으로 배치됩니다</li>
              <li>5주차는 해당 월에 5주가 없는 경우 무시됩니다</li>
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
