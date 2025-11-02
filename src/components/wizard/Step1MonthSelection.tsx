/**
 * Step 1: 월 선택 및 주간 패턴 배정
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Calendar, AlertCircle, ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import WeeklyPatternBuilder from './WeeklyPatternBuilder'

interface Props {
  wizardState: any
  updateWizardState: (updates: any) => void
  onNext: () => void
}

interface WeeklyPattern {
  id: string
  patternName: string
  isActive: boolean
}

export default function Step1MonthSelection({ wizardState, updateWizardState, onNext }: Props) {
  const { toast } = useToast()
  const [weeklyPatterns, setWeeklyPatterns] = useState<{ weekNumber: number; patternId: string }[]>([])

  const handlePatternsAssigned = (assignments: { weekNumber: number; patternId: string }[]) => {
    setWeeklyPatterns(assignments)
  }

  const handleNext = () => {
    // 주간 패턴이 할당되었는지 확인
    if (weeklyPatterns.length === 0) {
      toast({
        variant: 'destructive',
        title: '패턴 배정 필요',
        description: '모든 주에 주간 패턴을 배정해주세요'
      })
      return
    }

    updateWizardState({ weeklyPatterns })
    onNext()
  }

  return (
    <div className="space-y-6">
      {/* 월 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            1단계: 월 선택 및 주간 패턴 배정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 연도/월 선택 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">연도</label>
              <Select
                value={wizardState.year.toString()}
                onValueChange={(value) => updateWizardState({ year: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">월</label>
              <Select
                value={wizardState.month.toString()}
                onValueChange={(value) => updateWizardState({ month: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <SelectItem key={month} value={month.toString()}>
                      {month}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">주간 패턴이란?</p>
                <p>일주일 동안의 원장 근무 패턴입니다. 각 주마다 다른 패턴을 배정할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 주간 패턴 배정 - 드래그앤드롭 */}
      <WeeklyPatternBuilder
        year={wizardState.year}
        month={wizardState.month}
        onPatternsAssigned={handlePatternsAssigned}
      />

      {/* 하단 버튼 */}
      <div className="flex justify-end gap-3">
        <Button onClick={handleNext} size="lg">
          다음 단계
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
