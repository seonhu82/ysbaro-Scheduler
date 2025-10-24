'use client'

import { Card } from '@/components/ui/card'

export function SlotStatus() {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">슬롯 현황</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>전체 슬롯</span>
          <span className="font-bold">0</span>
        </div>
        <div className="flex justify-between">
          <span>사용 중</span>
          <span className="font-bold text-blue-600">0</span>
        </div>
        <div className="flex justify-between">
          <span>남은 슬롯</span>
          <span className="font-bold text-green-600">0</span>
        </div>
      </div>
    </Card>
  )
}
