'use client'

import { NotificationItem } from './NotificationItem'

interface NotificationPanelProps {
  notifications: any[]
  onNotificationClick?: (id: string) => void
  showEmpty?: boolean
}

export function NotificationPanel({
  notifications,
  onNotificationClick,
  showEmpty = true
}: NotificationPanelProps) {
  return (
    <div className="space-y-2 p-4">
      {notifications.length === 0 && showEmpty ? (
        <p className="text-gray-500 text-center py-8">알림이 없습니다.</p>
      ) : (
        notifications.map((notif) => (
          <NotificationItem
            key={notif.id}
            notification={notif}
            onClick={onNotificationClick}
          />
        ))
      )}
    </div>
  )
}
