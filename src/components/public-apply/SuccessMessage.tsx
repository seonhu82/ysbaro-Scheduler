'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  Calendar,
  Clock,
  Mail,
  Bell,
  ArrowRight,
  Home
} from 'lucide-react'

interface SuccessMessageProps {
  applicationId?: string
  date: Date
  leaveType: 'ANNUAL' | 'OFF'
  staffName?: string
  onGoHome?: () => void
  onViewStatus?: () => void
}

export function SuccessMessage({
  applicationId,
  date,
  leaveType,
  staffName,
  onGoHome,
  onViewStatus
}: SuccessMessageProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* 성공 메시지 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold mb-2">신청이 완료되었습니다</h1>
        <p className="text-gray-600">
          {staffName && `${staffName}님의 `}
          {leaveType === 'ANNUAL' ? '연차' : '오프'} 신청이 성공적으로 제출되었습니다
        </p>
      </div>

      {/* 신청 정보 카드 */}
      <Card className="mb-6 border-2 border-green-200">
        <CardHeader className="bg-green-50">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            신청 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {applicationId && (
            <div className="flex items-center justify-between pb-3 border-b">
              <span className="text-gray-600">신청 번호</span>
              <Badge variant="outline" className="font-mono">
                {applicationId}
              </Badge>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-gray-600">신청 날짜</span>
            <span className="font-semibold">{formatDate(date)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">신청 유형</span>
            <Badge variant={leaveType === 'ANNUAL' ? 'default' : 'secondary'}>
              {leaveType === 'ANNUAL' ? '연차' : '오프'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">상태</span>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">
              승인 대기 중
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 다음 단계 안내 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            다음 단계
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-blue-600">1</span>
            </div>
            <div>
              <p className="font-medium mb-1">관리자 검토</p>
              <p className="text-sm text-gray-600">
                관리자가 신청 내용을 검토합니다
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-blue-600">2</span>
            </div>
            <div>
              <p className="font-medium mb-1">승인 여부 결정</p>
              <p className="text-sm text-gray-600">
                신청이 승인되거나 반려됩니다
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-blue-600">3</span>
            </div>
            <div>
              <p className="font-medium mb-1">결과 알림</p>
              <p className="text-sm text-gray-600">
                승인 결과를 알림 및 이메일로 받게 됩니다
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 알림 설정 */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-blue-900 mb-2">알림 설정</p>
              <ul className="space-y-1 text-sm text-blue-800">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>이메일로 승인 결과를 받게 됩니다</span>
                </li>
                <li className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  <span>시스템 알림으로 실시간 상태를 확인할 수 있습니다</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 안내 사항 */}
      <Card className="mb-6 bg-gray-50">
        <CardContent className="pt-6">
          <p className="font-medium mb-3">참고 사항</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• 신청 취소는 승인 전까지만 가능합니다</li>
            <li>• 승인 후에는 변경이 불가능하니 신중히 신청해주세요</li>
            <li>• 긴급한 사항은 관리자에게 직접 연락해주세요</li>
            <li>
              • {leaveType === 'ANNUAL'
                  ? '연차는 승인 후 자동으로 연차 일수에서 차감됩니다'
                  : '오프는 주당 2일까지만 가능합니다'}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {onViewStatus && (
          <Button
            variant="outline"
            onClick={onViewStatus}
            className="flex-1"
          >
            <Calendar className="w-4 h-4 mr-2" />
            신청 내역 보기
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
        {onGoHome && (
          <Button onClick={onGoHome} className="flex-1">
            <Home className="w-4 h-4 mr-2" />
            처음으로
          </Button>
        )}
      </div>

      {/* 추가 도움말 */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>문의사항이 있으신가요?</p>
        <p className="mt-1">
          관리자에게 문의하시거나{' '}
          <a href="mailto:admin@example.com" className="text-blue-600 hover:underline">
            admin@example.com
          </a>
          으로 이메일을 보내주세요
        </p>
      </div>
    </div>
  )
}
