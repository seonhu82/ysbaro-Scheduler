'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface ActivityLog {
  id: string
  activityType: string
  description: string
  createdAt: string
  user: {
    name: string
    email: string
    role: string
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [filter, page])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: '50',
        offset: ((page - 1) * 50).toString()
      })

      if (filter !== 'all') {
        params.append('activityType', filter)
      }

      const response = await fetch(`/api/activity-log?${params}`)
      const result = await response.json()

      if (result.success) {
        setLogs(result.data.logs)
        setHasMore(result.data.hasMore)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      SCHEDULE_CREATE: '스케줄 생성',
      SCHEDULE_UPDATE: '스케줄 수정',
      SCHEDULE_DELETE: '스케줄 삭제',
      SCHEDULE_CONFIRM: '스케줄 확정',
      SCHEDULE_DEPLOY: '스케줄 배포',
      LEAVE_SUBMIT: '연차 신청',
      LEAVE_APPROVE: '연차 승인',
      LEAVE_REJECT: '연차 거절',
      STAFF_CREATE: '직원 등록',
      STAFF_UPDATE: '직원 수정',
      STAFF_DELETE: '직원 삭제',
      SETTINGS_UPDATE: '설정 변경',
      LOGIN: '로그인',
      LOGOUT: '로그아웃'
    }
    return labels[type] || type
  }

  const getActivityTypeColor = (type: string) => {
    if (type.includes('CREATE')) return 'text-green-600'
    if (type.includes('DELETE')) return 'text-red-600'
    if (type.includes('APPROVE')) return 'text-blue-600'
    if (type.includes('REJECT')) return 'text-orange-600'
    return 'text-gray-600'
  }

  if (loading && logs.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">활동 로그</h1>
        <p>로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">활동 로그</h1>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(1)
          }}
          className="border rounded px-3 py-2"
        >
          <option value="all">전체</option>
          <option value="SCHEDULE_CREATE">스케줄 생성</option>
          <option value="SCHEDULE_CONFIRM">스케줄 확정</option>
          <option value="SCHEDULE_DEPLOY">스케줄 배포</option>
          <option value="LEAVE_SUBMIT">연차 신청</option>
          <option value="LEAVE_APPROVE">연차 승인</option>
          <option value="STAFF_CREATE">직원 등록</option>
          <option value="SETTINGS_UPDATE">설정 변경</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>활동 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">활동 로그가 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between border-b pb-4 last:border-b-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold ${getActivityTypeColor(log.activityType)}`}>
                        {getActivityTypeLabel(log.activityType)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(log.createdAt), {
                          addSuffix: true,
                          locale: ko
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{log.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{log.user.name}</span>
                      <span>·</span>
                      <span>{log.user.email}</span>
                      <span>·</span>
                      <span>{log.user.role}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(log.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {logs.length > 0 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                이전
              </Button>
              <span className="px-4 py-2 text-sm">
                {page} 페이지
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!hasMore}
              >
                다음
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
