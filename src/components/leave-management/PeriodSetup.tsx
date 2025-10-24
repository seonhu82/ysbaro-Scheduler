'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function PeriodSetup() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">신청 기간 설정</h2>
      <div className="grid grid-cols-2 gap-4">
        <Input type="date" placeholder="시작일" />
        <Input type="date" placeholder="종료일" />
      </div>
      <Button>기간 설정</Button>
    </div>
  )
}
