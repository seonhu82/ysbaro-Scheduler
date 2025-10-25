'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { NotificationBadge } from '@/components/notifications/NotificationBadge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { NotificationPanel } from '@/components/notifications/NotificationPanel'
import { useRouter } from 'next/navigation'

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // SSE 실시간 알림 연결
  useEffect(() => {
    let eventSource: EventSource | null = null

    const connectSSE = () => {
      eventSource = new EventSource('/api/notifications/sse')

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'connected') {
            console.log('SSE connected:', data.message)
          } else if (data.type === 'notification') {
            // 새 알림 추가
            setNotifications(prev => [data.notification, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        } catch (error) {
          console.error('Failed to parse SSE data:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE error:', error)
        eventSource?.close()
        // 5초 후 재연결 시도
        setTimeout(connectSSE, 5000)
      }
    }

    connectSSE()

    return () => {
      eventSource?.close()
    }
  }, [])

  // 초기 알림 로드
  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications?limit=5')
      const result = await response.json()

      if (result.success) {
        setNotifications(result.data.notifications)
        setUnreadCount(result.data.unreadCount)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewAll = () => {
    setOpen(false)
    router.push('/notifications')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
          <Bell className="w-6 h-6" />
          <NotificationBadge count={unreadCount} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold">알림</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : (
            <NotificationPanel notifications={notifications.slice(0, 5)} />
          )}
        </div>
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleViewAll}
          >
            모든 알림 보기
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
