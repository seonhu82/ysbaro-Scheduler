import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export function useNotifications() {
  const queryClient = useQueryClient()

  // 알림 목록 조회
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications')
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch notifications')
      }
      return result.data as Notification[]
    },
    refetchInterval: 30000 // 30초마다 자동 새로고침
  })

  // 알림 읽음 처리
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH'
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to mark notification as read')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  // 모든 알림 읽음 처리
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH'
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to mark all as read')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  // 알림 삭제
  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete notification')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const unreadCount = data?.filter((n) => !n.isRead).length || 0

  return {
    notifications: data || [],
    unreadCount,
    isLoading,
    error,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
    deleteNotification: deleteNotification.mutate
  }
}
