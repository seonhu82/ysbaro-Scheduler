'use client'

import { NotificationItem } from './NotificationItem'

export function NotificationPanel({ notifications }: { notifications: any[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-bold mb-4">알림</h2>
      {notifications.length === 0 ? (
        <p className="text-gray-500 text-center py-8">알림이 없습니다.</p>
      ) : (
        notifications.map((notif) => (
          <NotificationItem key={notif.id} notification={notif} />
        ))
      )}
    </div>
  )
}
