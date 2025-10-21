// Server-Sent Events for Real-time Notifications ⭐⭐

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user.clinicId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const clinicId = session.user.clinicId
  let lastNotificationId: string | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      // 초기 연결 메시지
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`
        )
      )

      // 5초마다 새 알림 확인
      const interval = setInterval(async () => {
        try {
          const where: any = {
            clinicId,
            isRead: false,
          }

          // 마지막으로 전송한 알림 이후의 새 알림만 조회
          if (lastNotificationId) {
            where.id = { gt: lastNotificationId }
          }

          const newNotifications = await prisma.notification.findMany({
            where,
            orderBy: {
              createdAt: 'asc',
            },
            take: 10,
          })

          if (newNotifications.length > 0) {
            // 각 알림을 개별 이벤트로 전송
            for (const notification of newNotifications) {
              const data = {
                type: 'notification',
                notification,
              }

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
              )

              lastNotificationId = notification.id
            }
          }

          // Heartbeat (연결 유지)
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch (error) {
          console.error('SSE error:', error)
        }
      }, 5000)

      // 연결 종료 처리
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
