'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function DayPatternEditor() {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">일 패턴 편집기</h2>
      <p className="text-gray-600">요일별 근무 패턴을 설정합니다.</p>
      <div className="mt-4 space-y-4">
        {/* TODO: 패턴 편집 UI 구현 */}
        <Button>패턴 저장</Button>
      </div>
    </Card>
  )
}
