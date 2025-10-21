'use client'

// 실시간 슬롯 현황 (SSE)
import { useEffect, useState } from 'react'

export function RealTimeStatus({ token }: { token: string }) {
  const [slots, setSlots] = useState([])

  useEffect(() => {
    // TODO: SSE 연결
    const eventSource = new EventSource(`/api/leave-apply/${token}/status/sse`)

    eventSource.onmessage = (event) => {
      // TODO: 슬롯 현황 업데이트
    }

    return () => eventSource.close()
  }, [token])

  return (
    <div>
      {/* TODO: 슬롯 현황 표시 */}
    </div>
  )
}
