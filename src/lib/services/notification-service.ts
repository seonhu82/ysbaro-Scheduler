// 알림 서비스
import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

export class NotificationService {
  async createNotification(
    clinicId: string,
    userId: string,
    title: string,
    message: string,
    type: NotificationType
  ) {
    return prisma.notification.create({
      data: { clinicId, userId, title, message, type, isRead: false }
    })
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, isRead: false }
    })
  }
}
