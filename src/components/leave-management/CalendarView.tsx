'use client'

import { Card } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

export function CalendarView() {
  return (
    <Card className="p-12 text-center">
      <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
      <h3 className="text-lg font-semibold mb-2">달력뷰</h3>
      <p className="text-gray-600">
        연차 신청 내역을 달력 형태로 확인할 수 있습니다.
        <br />
        (구현 예정)
      </p>
    </Card>
  )
}
