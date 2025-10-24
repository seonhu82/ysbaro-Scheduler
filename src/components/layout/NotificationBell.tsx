'use client'

import { Bell } from 'lucide-react'
import { NotificationBadge } from '@/components/notifications/NotificationBadge'

export function NotificationBell({ count }: { count: number }) {
  return (
    <button className="relative p-2 hover:bg-gray-100 rounded-full">
      <Bell className="w-6 h-6" />
      <NotificationBadge count={count} />
    </button>
  )
}
