'use client'

import { Button } from '@/components/ui/button'

export function NotificationFilter() {
  return (
    <div className="flex gap-2 mb-4">
      <Button variant="outline" size="sm">전체</Button>
      <Button variant="outline" size="sm">읽지 않음</Button>
      <Button variant="outline" size="sm">중요</Button>
    </div>
  )
}
