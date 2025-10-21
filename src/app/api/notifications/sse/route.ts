// Server-Sent Events ⭐⭐

export async function GET(request: Request) {
  // TODO: SSE 구현
  // ReadableStream으로 실시간 알림 전송

  const stream = new ReadableStream({
    start(controller) {
      // TODO: 3초마다 새 알림 확인
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
