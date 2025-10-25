'use client'

import { Card } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Bell, CheckCircle, AlertCircle, Info } from 'lucide-react'

interface NotificationItemProps {
  notification: any
  onClick?: (id: string) => void
}

const typeIcons = {
  SUCCESS: CheckCircle,
  ERROR: AlertCircle,
  INFO: Info,
  ALERT: Bell
}

const typeColors = {
  SUCCESS: 'text-green-500',
  ERROR: 'text-red-500',
  INFO: 'text-blue-500',
  ALERT: 'text-amber-500'
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const Icon = typeIcons[notification.type as keyof typeof typeIcons] || Info
  const iconColor = typeColors[notification.type as keyof typeof typeColors] || 'text-gray-500'

  const handleClick = () => {
    if (onClick && !notification.isRead) {
      onClick(notification.id)
    }
  }

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ko
  })

  return (
    <Card
      className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
        notification.isRead ? 'bg-gray-50 opacity-75' : 'bg-white'
      }`}
      onClick={handleClick}
    >
      <div className="flex gap-3">
        <div className={`flex-shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <p className="font-semibold text-sm">{notification.title}</p>
            {!notification.isRead && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.message}</p>
          <p className="text-xs text-gray-400 mt-2">{timeAgo}</p>
        </div>
      </div>
    </Card>
  )
}
