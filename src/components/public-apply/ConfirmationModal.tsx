'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Calendar,
  FileText,
  Phone,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react'
import type { ApplicationData } from './ApplicationForm'

interface ConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ApplicationData | null
  staffName?: string
  onConfirm: () => Promise<void>
}

export function ConfirmationModal({
  open,
  onOpenChange,
  data,
  staffName,
  onConfirm
}: ConfirmationModalProps) {
  const [confirming, setConfirming] = useState(false)

  if (!data) return null

  const handleConfirm = async () => {
    try {
      setConfirming(true)
      await onConfirm()
    } catch (error) {
      console.error('Confirmation failed:', error)
    } finally {
      setConfirming(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

  const isWeekend = data.date.getDay() === 0 || data.date.getDay() === 6

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="w-6 h-6 text-blue-600" />
            신청 내용 확인
          </DialogTitle>
          <DialogDescription>
            아래 내용을 확인하시고 신청을 완료해주세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 신청자 정보 */}
          {staffName && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-xl font-bold text-blue-600">
                      {staffName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">신청자</p>
                    <p className="font-semibold text-lg">{staffName}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 신청 상세 정보 */}
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardContent className="pt-6 space-y-4">
              {/* 날짜 */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-700 mb-1">신청 날짜</p>
                  <p className="font-semibold text-lg">{formatDate(data.date)}</p>
                  {isWeekend && (
                    <Badge variant="outline" className="mt-2">
                      주말
                    </Badge>
                  )}
                </div>
              </div>

              {/* 유형 */}
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-700 mb-1">신청 유형</p>
                  <Badge
                    variant={data.leaveType === 'ANNUAL' ? 'default' : 'secondary'}
                    className="text-base px-3 py-1"
                  >
                    {data.leaveType === 'ANNUAL' ? '연차' : '오프'}
                  </Badge>
                  <p className="text-xs text-gray-600 mt-2">
                    {data.leaveType === 'ANNUAL'
                      ? '정규 연차를 사용합니다 (연차 일수 차감)'
                      : '주간 오프를 사용합니다 (연차 차감 없음)'}
                  </p>
                </div>
              </div>

              {/* 사유 */}
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-700 mb-1">신청 사유</p>
                  <p className="text-gray-900 whitespace-pre-wrap bg-white p-3 rounded border">
                    {data.reason}
                  </p>
                </div>
              </div>

              {/* 비상 연락처 */}
              {data.emergencyContact && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 mb-1">비상 연락처</p>
                    <p className="font-mono text-gray-900">{data.emergencyContact}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 안내 사항 */}
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-yellow-900 mb-2">
                    신청 전 확인사항
                  </p>
                  <ul className="space-y-1 text-yellow-800">
                    <li>• 신청 후에는 수정이 불가능합니다</li>
                    <li>• 취소는 승인 전까지만 가능합니다</li>
                    <li>
                      • {data.leaveType === 'ANNUAL' ? '연차는 승인 후 연차 일수에서 차감됩니다' : '오프는 주당 최대 2일까지 가능합니다'}
                    </li>
                    <li>• 승인 여부는 알림 또는 이메일로 전송됩니다</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirming}
            className="min-w-32"
          >
            {confirming ? '신청 중...' : '신청 완료'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
