'use client'

import { Card } from '@/components/ui/card'

export function NotificationItem({ notification }: { notification: any }) {
  return (
    <Card className={`p-4 ${notification.isRead ? 'bg-gray-50' : 'bg-white'}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">{notification.title}</p>
          <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
          <p className="text-xs text-gray-400 mt-2">{notification.createdAt}</p>
        </div>
        {!notification.isRead && (
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
        )}
      </div>
    </Card>
  )
}
