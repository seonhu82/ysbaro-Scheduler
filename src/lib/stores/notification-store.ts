// 알림 스토어
import { create } from 'zustand'

interface NotificationStore {
  notifications: any[]
  unreadCount: number
  setNotifications: (notifs: any[]) => void
  markAsRead: (id: string) => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifs) => set({
    notifications: notifs,
    unreadCount: notifs.filter(n => !n.isRead).length
  }),
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    ),
    unreadCount: state.unreadCount - 1
  })),
}))
