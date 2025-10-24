'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ApplicationCard({ application }: { application: any }) {
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-semibold">{application.staffName}</p>
          <p className="text-sm text-gray-600">{application.date}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline">승인</Button>
          <Button size="sm" variant="destructive">거부</Button>
        </div>
      </div>
    </Card>
  )
}
