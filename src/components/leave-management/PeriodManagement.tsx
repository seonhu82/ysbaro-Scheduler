'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Check,
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
  const [leaveApplyToken, setLeaveApplyToken] = useState<string>('')
  const [copied, setCopied] = useState(false)

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
    fetchToken()
  }, [])

  // 연차/오프 신청 URL 생성
  const leaveApplyUrl = typeof window !== 'undefined' && leaveApplyToken
    ? `${window.location.protocol}//${window.location.host}/leave-apply/${leaveApplyToken}`
    : ''

  // 토큰 조회
  const fetchToken = async () => {
    try {
      const response = await fetch('/api/leave-apply/token')
      const data = await response.json()
      if (data.success && data.token) {
        setLeaveApplyToken(data.token)
      }
    } catch (error) {
      console.error('Failed to fetch leave apply token:', error)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(leaveApplyUrl)
      setCopied(true)
      toast({
        title: 'URL 복사 완료',
        description: '연차/오프 신청 URL이 클립보드에 복사되었습니다.'
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '복사 실패',
        description: 'URL 복사 중 오류가 발생했습니다.'
      })
    }
  }

  const handleKakaoShare = () => {
    toast({
      title: '카카오톡 공유',
      description: '카카오톡 API 설정 후 사용 가능합니다.'
    })
  }

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

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: '진행중', color: 'bg-green-100 text-green-800' },
    CLOSED: { label: '마감', color: 'bg-gray-100 text-gray-800' },
    CONFIRMED: { label: '확정', color: 'bg-blue-100 text-blue-800' },
  }

  const getStatusLabel = (status: string) => {
    return STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-800' }
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
      {/* 연차/오프 신청 URL 공유 */}
      {leaveApplyUrl && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <LinkIcon className="w-5 h-5" />
              연차/오프 신청 URL 공유
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-700">
              직원들이 연차/오프를 신청할 수 있는 URL입니다. 아래 버튼으로 URL을 복사하거나 카카오톡으로 공유할 수 있습니다.
            </p>

            {/* URL 표시 */}
            <div className="bg-white border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
              <code className="text-sm text-gray-700 flex-1 overflow-x-auto">
                {leaveApplyUrl}
              </code>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <Button
                onClick={handleCopyUrl}
                variant={copied ? "default" : "outline"}
                className={copied ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    복사 완료
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    URL 복사
                  </>
                )}
              </Button>

              <Button
                onClick={handleKakaoShare}
                variant="outline"
                className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
              >
                카카오톡 공유 (API 설정 필요)
              </Button>
            </div>

            <p className="text-xs text-green-600">
              💡 이 URL은 직원들이 이름과 PIN을 입력하여 안전하게 연차/오프를 신청할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      )}

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
                <Badge className={getStatusLabel(period.status).color}>
                  {getStatusLabel(period.status).label}
                </Badge>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span>신청: {period._count?.applications || 0}건</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>슬롯: {period.slotLimits?.length || 0}일</span>
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
