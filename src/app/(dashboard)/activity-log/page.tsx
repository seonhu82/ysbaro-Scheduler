/**
 * 활동 로그 페이지
 * 경로: /activity-log
 *
 * 기능:
 * - 시스템 활동 이력 조회
 * - 날짜/사용자/활동 유형별 필터링
 * - 상세 메타데이터 표시
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  History,
  User,
  Calendar,
  Settings,
  LogIn,
  LogOut,
  FileEdit,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface ActivityLog {
  id: string
  activityType: string
  description: string
  metadata: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    name: string
    email: string
    role: string
  } | null
}

const activityTypeConfig = {
  SCHEDULE_CREATED: {
    label: '스케줄 생성',
    icon: Calendar,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50'
  },
  SCHEDULE_UPDATED: {
    label: '스케줄 수정',
    icon: FileEdit,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50'
  },
  SCHEDULE_DEPLOYED: {
    label: '스케줄 배포',
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-50'
  },
  LEAVE_SUBMITTED: {
    label: '연차 신청',
    icon: FileEdit,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50'
  },
  LEAVE_CONFIRMED: {
    label: '연차 확정',
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-50'
  },
  LEAVE_CANCELLED: {
    label: '연차 취소',
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50'
  },
  SETTINGS_UPDATED: {
    label: '설정 변경',
    icon: Settings,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50'
  },
  USER_LOGIN: {
    label: '로그인',
    icon: LogIn,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50'
  },
  USER_LOGOUT: {
    label: '로그아웃',
    icon: LogOut,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50'
  }
}

export default function ActivityLogPage() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('all')
  const [totalCount, setTotalCount] = useState(0)

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (activityTypeFilter !== 'all') params.append('activityType', activityTypeFilter)

      const response = await fetch(`/api/activity-log?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data.logs)
        setTotalCount(data.data.totalCount)
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: data.error
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

  useEffect(() => {
    fetchLogs()
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <History className="w-7 h-7" />
          활동 로그
        </h1>
        <p className="text-gray-600">
          시스템의 모든 활동 이력을 조회합니다
        </p>
      </div>

      {/* 필터 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>검색 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">시작 날짜</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">종료 날짜</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label>활동 유형</Label>
              <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="SCHEDULE_CREATED">스케줄 생성</SelectItem>
                  <SelectItem value="SCHEDULE_UPDATED">스케줄 수정</SelectItem>
                  <SelectItem value="SCHEDULE_DEPLOYED">스케줄 배포</SelectItem>
                  <SelectItem value="LEAVE_SUBMITTED">연차 신청</SelectItem>
                  <SelectItem value="LEAVE_CONFIRMED">연차 확정</SelectItem>
                  <SelectItem value="LEAVE_CANCELLED">연차 취소</SelectItem>
                  <SelectItem value="SETTINGS_UPDATED">설정 변경</SelectItem>
                  <SelectItem value="USER_LOGIN">로그인</SelectItem>
                  <SelectItem value="USER_LOGOUT">로그아웃</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={fetchLogs} className="w-full">
                조회
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 로그 테이블 */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP 주소</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-500" />
                    <p className="text-gray-500">로딩 중...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    활동 로그가 없습니다
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const config = activityTypeConfig[log.activityType as keyof typeof activityTypeConfig]
                  const Icon = config?.icon || History
                  const timeAgo = formatDistanceToNow(new Date(log.createdAt), {
                    addSuffix: true,
                    locale: ko
                  })

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>
                          <div className="font-medium">
                            {new Date(log.createdAt).toLocaleString('ko-KR')}
                          </div>
                          <div className="text-xs text-gray-500">{timeAgo}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Badge variant="outline" className={config?.bgColor || 'bg-gray-50'}>
                          <Icon className={`w-3 h-3 mr-1 ${config?.color || 'text-gray-500'}`} />
                          {config?.label || log.activityType}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="max-w-md">
                          {log.description}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              {JSON.stringify(log.metadata, null, 2)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.user ? (
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.user.name}
                            </div>
                            <div className="text-xs text-gray-500">{log.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">시스템</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {log.ipAddress || '-'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 푸터 */}
        {!loading && logs.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t">
            <div className="flex justify-between text-sm text-gray-600">
              <span>총 {totalCount}건</span>
              <span>표시: {logs.length}건</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
