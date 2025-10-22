'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Link as LinkIcon,
  Calendar,
  Users,
  Copy,
  CheckCircle,
  XCircle,
  Trash2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { CreatePeriodDialog } from './CreatePeriodDialog'

interface SlotLimit {
  id: string
  date: string
  dayType: string
  maxSlots: number
}

interface ApplicationLink {
  id: string
  token: string
  year: number
  month: number
  expiresAt: string
  status: 'ACTIVE' | 'CLOSED' | 'CONFIRMED'
  slotLimits: SlotLimit[]
  _count: {
    applications: number
  }
}

export function PeriodManagement() {
  const { toast } = useToast()
  const [periods, setPeriods] = useState<ApplicationLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const fetchPeriods = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave-management/period')
      const result = await response.json()

      if (result.success) {
        setPeriods(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch periods:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPeriods()
  }, [])

  const copyLinkToClipboard = (token: string) => {
    const url = `${window.location.origin}/leave-apply/${token}`
    navigator.clipboard.writeText(url)
    toast({
      title: '링크 복사 완료',
      description: '연차 신청 링크가 클립보드에 복사되었습니다.',
    })
  }

  const handleConfirm = async (id: string) => {
    if (!confirm('신청을 확정하시겠습니까? 확정 후에는 취소할 수 없습니다.')) {
      return
    }

    try {
      const response = await fetch(
        `/api/leave-management/period/${id}/confirm`,
        {
          method: 'POST',
        }
      )

      const result = await response.json()

      if (result.success) {
        toast({
          title: '확정 완료',
          description: '연차 신청이 확정되었습니다.',
        })
        fetchPeriods()
      } else {
        throw new Error(result.error || '확정 실패')
      }
    } catch (error: any) {
      toast({
        title: '확정 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    }
  }

  const handleReopen = async (id: string) => {
    if (!confirm('신청 기간을 재오픈하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch(
        `/api/leave-management/period/${id}/reopen`,
        {
          method: 'POST',
        }
      )

      const result = await response.json()

      if (result.success) {
        toast({
          title: '재오픈 완료',
          description: '신청 기간이 재오픈되었습니다.',
        })
        fetchPeriods()
      } else {
        throw new Error(result.error || '재오픈 실패')
      }
    } catch (error: any) {
      toast({
        title: '재오픈 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    }
  }

  const STATUS_LABELS = {
    ACTIVE: { label: '진행중', color: 'bg-green-100 text-green-800' },
    CLOSED: { label: '마감', color: 'bg-gray-100 text-gray-800' },
    CONFIRMED: { label: '확정', color: 'bg-blue-100 text-blue-800' },
  }

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <p className="text-gray-600">로딩 중...</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">신청 기간 관리</h2>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          신청 기간 생성
        </Button>
      </div>

      {periods.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 mb-4">생성된 신청 기간이 없습니다.</p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            첫 신청 기간 생성하기
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {periods.map((period) => (
            <Card key={period.id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold">
                    {period.year}년 {period.month}월
                  </h3>
                  <p className="text-sm text-gray-600">
                    만료: {new Date(period.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={STATUS_LABELS[period.status].color}>
                  {STATUS_LABELS[period.status].label}
                </Badge>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span>신청: {period._count.applications}건</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>슬롯: {period.slotLimits.length}일</span>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => copyLinkToClipboard(period.token)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  링크 복사
                </Button>

                {period.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleConfirm(period.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    확정
                  </Button>
                )}

                {period.status === 'CLOSED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleReopen(period.id)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    재오픈
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreatePeriodDialog
        open={showCreateDialog}
        onClose={(created) => {
          setShowCreateDialog(false)
          if (created) {
            fetchPeriods()
          }
        }}
      />
    </div>
  )
}
