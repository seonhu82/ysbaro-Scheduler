'use client'

import { Card } from '@/components/ui/card'
import { Users } from 'lucide-react'

export function StaffView() {
  return (
    <Card className="p-12 text-center">
      <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
      <h3 className="text-lg font-semibold mb-2">직원별뷰</h3>
      <p className="text-gray-600">
        직원별로 연차 신청 내역과 잔여 연차를 확인할 수 있습니다.
        <br />
        (구현 예정)
      </p>
    </Card>
  )
}
