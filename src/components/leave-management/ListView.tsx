'use client'

import { Card } from '@/components/ui/card'
import { List } from 'lucide-react'

export function ListView() {
  return (
    <Card className="p-12 text-center">
      <List className="w-16 h-16 mx-auto mb-4 text-gray-300" />
      <h3 className="text-lg font-semibold mb-2">목록뷰</h3>
      <p className="text-gray-600">
        연차 신청 내역을 목록 형태로 확인하고 승인/취소할 수 있습니다.
        <br />
        (구현 예정)
      </p>
    </Card>
  )
}
