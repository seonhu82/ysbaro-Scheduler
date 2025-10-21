// 알림 관련 타입 정의

import type { Notification, User } from '@prisma/client'

/**
 * 알림 (관계 포함)
 */
export interface NotificationWithUser extends Notification {
  user: User
}

/**
 * 알림 생성 데이터
 */
export interface NotificationCreateInput {
  userId: string
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
  category: 'LEAVE' | 'SCHEDULE' | 'FAIRNESS' | 'SYSTEM'
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
}

/**
 * 브라우저 알림 데이터
 */
export interface BrowserNotificationData {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
}

/**
 * SSE 메시지
 */
export interface SSEMessage {
  type: 'notification' | 'heartbeat' | 'error'
  data?: Notification | string
  timestamp: string
}
