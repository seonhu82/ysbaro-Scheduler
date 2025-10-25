/**
 * 알림 페이지
 * 경로: /notifications
 *
 * 기능:
 * - 모든 알림 조회
 * - 읽음/읽지 않음 필터
 * - 알림 읽음 처리
 * - 전체 읽음 처리
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bell, CheckCheck, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { NotificationItem } from '@/components/notifications/NotificationItem'

export default function NotificationsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<string>('all') // 'all', 'unread', 'read'

  useEffect(() => {
    fetchNotifications()
  }, [filter])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter === 'unread') params.append('unreadOnly', 'true')

      const response = await fetch(`/api/notifications?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        let filteredNotifications = result.data.notifications
        if (filter === 'read') {
          filteredNotifications = filteredNotifications.filter((n: any) => n.isRead)
        }
        setNotifications(filteredNotifications)
        setUnreadCount(result.data.unreadCount)
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: result.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationIds: [notificationId]
        })
      })

      const result = await response.json()

      if (result.success) {
        // 로컬 상태 업데이트
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          markAll: true
        })
      })

      const result = await response.json()

      if (result.success) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true }))
        )
        setUnreadCount(0)
        toast({
          title: '완료',
          description: '모든 알림을 읽음 처리했습니다'
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '전체 읽음 처리에 실패했습니다'
      })
    }
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Bell className="w-7 h-7" />
            알림
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-gray-600">
            시스템 알림과 중요한 메시지를 확인하세요
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchNotifications}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-2" />
              모두 읽음
            </Button>
          )}
        </div>
      </div>

      {/* 필터 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">필터:</label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="unread">읽지 않음</SelectItem>
                <SelectItem value="read">읽음</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500">
              총 {notifications.length}건
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 알림 리스트 */}
      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-500" />
                <p className="text-gray-500">로딩 중...</p>
              </div>
            </CardContent>
          </Card>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">
                  {filter === 'unread' ? '읽지 않은 알림이 없습니다' : '알림이 없습니다'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onClick={handleMarkAsRead}
            />
          ))
        )}
      </div>
    </div>
  )
}
