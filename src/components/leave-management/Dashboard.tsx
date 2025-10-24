'use client'

import { Card } from '@/components/ui/card'

export function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-6">
        <h3 className="text-lg font-semibold">전체 신청</h3>
        <p className="text-3xl font-bold mt-2">0</p>
      </Card>
      <Card className="p-6">
        <h3 className="text-lg font-semibold">승인 대기</h3>
        <p className="text-3xl font-bold mt-2">0</p>
      </Card>
      <Card className="p-6">
        <h3 className="text-lg font-semibold">승인 완료</h3>
        <p className="text-3xl font-bold mt-2">0</p>
      </Card>
    </div>
  )
}
