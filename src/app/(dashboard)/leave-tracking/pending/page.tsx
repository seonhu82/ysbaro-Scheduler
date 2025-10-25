/**
 * 재배치 대기 목록 페이지
 * 경로: /leave-tracking/pending
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RefreshCw, Play, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PendingItem {
  id: string
  changeType: string
  oldStatus?: string
  newStatus?: string
  affectedWeekIds: string[]
  createdAt: string
  leaveApplication: {
    staff: {
      name: string
    }
  }
}

export default function PendingReassignmentsPage() {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const { toast } = useToast()

  const loadPendingItems = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave-tracking/pending')
      const data = await response.json()

      if (data.success) {
        setPendingItems(data.data)
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPendingItems()
  }, [])

  const handleReassign = async (changeLogId: string) => {
    if (!confirm('이 변경 사항에 대해 재배치를 실행하시겠습니까?')) {
      return
    }

    try {
      setProcessing(changeLogId)
      const response = await fetch('/api/leave-tracking/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeLogId })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '재배치 완료',
          description: data.message
        })
        loadPendingItems()
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setProcessing(null)
    }
  }

  const getChangeTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; variant: any }> = {
      'STATUS_CHANGE': { label: '상태 변경', variant: 'default' },
      'DATE_CHANGE': { label: '날짜 변경', variant: 'secondary' },
      'DELETION': { label: '삭제', variant: 'destructive' }
    }

    const config = typeMap[type] || { label: type, variant: 'outline' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">재배치 대기 목록</h1>
        <p className="text-gray-600">
          연차/오프 변경으로 인해 재배치가 필요한 항목을 관리합니다
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            대기 중인 재배치 ({pendingItems.length}건)
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadPendingItems} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </CardHeader>
        <CardContent>
          {pendingItems.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p className="text-gray-600">재배치가 필요한 항목이 없습니다</p>
              <p className="text-sm text-gray-500 mt-1">
                모든 변경 사항이 처리되었습니다
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>변경 유형</TableHead>
                  <TableHead>직원</TableHead>
                  <TableHead>상태 변경</TableHead>
                  <TableHead>영향받는 주차</TableHead>
                  <TableHead>변경 일시</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{getChangeTypeBadge(item.changeType)}</TableCell>
                    <TableCell className="font-medium">
                      {item.leaveApplication.staff.name}
                    </TableCell>
                    <TableCell>
                      {item.oldStatus && item.newStatus ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">{item.oldStatus}</Badge>
                          <span>→</span>
                          <Badge variant="outline">{item.newStatus}</Badge>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {item.affectedWeekIds.length}개 주차
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(item.createdAt).toLocaleString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleReassign(item.id)}
                        disabled={processing === item.id || loading}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        {processing === item.id ? '처리 중...' : '재배치 실행'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
