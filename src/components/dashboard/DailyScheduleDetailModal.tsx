/**
 * 일별 스케줄 상세 모달
 * - 특정 날짜의 직원 배정 상세 정보
 * - 원장, 직원별 출근 여부
 * - 연차/오프 신청자 목록
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Moon, Users, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'

interface DailyDetailData {
  date: string
  doctors: Array<{
    id: string
    name: string
    hasNightShift: boolean
  }>
  staff: Array<{
    id: string
    name: string
    category: string
    isAssigned: boolean
    leaveType?: 'ANNUAL' | 'OFF'
    leaveStatus?: string
  }>
  leaves: Array<{
    staffId: string
    staffName: string
    type: 'ANNUAL' | 'OFF'
    status: string
  }>
  isHoliday: boolean
  holidayName?: string
}

interface Props {
  date: Date
  onClose: () => void
  onRefresh: () => void
}

export default function DailyScheduleDetailModal({ date, onClose, onRefresh }: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<DailyDetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDailyDetail()
  }, [date])

  const fetchDailyDetail = async () => {
    try {
      setLoading(true)
      const dateStr = format(date, 'yyyy-MM-dd')
      const response = await fetch(`/api/schedule/daily-detail?date=${dateStr}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast({
          variant: 'destructive',
          title: '로드 실패',
          description: result.error || '상세 정보를 불러올 수 없습니다'
        })
      }
    } catch (error) {
      console.error('Failed to fetch daily detail:', error)
      toast({
        variant: 'destructive',
        title: '오류',
        description: '상세 정보를 불러오는 중 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {format(date, 'yyyy년 M월 d일 (E)', { locale: ko })} 스케줄 상세
          </DialogTitle>
          {data?.isHoliday && data?.holidayName && (
            <DialogDescription>
              <Badge variant="destructive" className="mt-2">
                {data.holidayName}
              </Badge>
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
            <p className="text-gray-500">로딩 중...</p>
          </div>
        ) : !data ? (
          <div className="py-12 text-center text-gray-500">데이터를 불러올 수 없습니다</div>
        ) : (
          <div className="space-y-6">
            {/* 원장 배정 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                원장 배정
              </h3>
              {data.doctors.length === 0 ? (
                <p className="text-sm text-gray-500">배정된 원장이 없습니다</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.doctors.map(doctor => (
                    <Badge key={doctor.id} variant="outline" className="flex items-center gap-1">
                      {doctor.name}
                      {doctor.hasNightShift && <Moon className="w-3 h-3 text-indigo-500" />}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* 직원 배정 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">직원 배정</h3>
              {data.staff.length === 0 ? (
                <p className="text-sm text-gray-500">배정된 직원이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {/* 카테고리별 그룹화 */}
                  {Array.from(new Set(data.staff.map(s => s.category))).map(category => (
                    <div key={category} className="border rounded-lg p-3">
                      <div className="text-xs font-medium text-gray-600 mb-2">{category}</div>
                      <div className="flex flex-wrap gap-2">
                        {data.staff
                          .filter(s => s.category === category)
                          .map(staff => (
                            <Badge
                              key={staff.id}
                              variant={staff.isAssigned ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {staff.name}
                              {staff.leaveType && (
                                <span className="ml-1 text-xs">
                                  ({staff.leaveType === 'ANNUAL' ? '연차' : '오프'})
                                </span>
                              )}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 연차/오프 신청 현황 */}
            {data.leaves.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">연차/오프 신청 현황</h3>
                <div className="space-y-2">
                  {data.leaves.map((leave, idx) => (
                    <div key={idx} className="flex items-center justify-between border rounded p-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{leave.staffName}</span>
                        <Badge variant={leave.type === 'ANNUAL' ? 'default' : 'secondary'}>
                          {leave.type === 'ANNUAL' ? '연차' : '오프'}
                        </Badge>
                      </div>
                      <Badge
                        variant={
                          leave.status === 'CONFIRMED'
                            ? 'default'
                            : leave.status === 'ON_HOLD'
                            ? 'secondary'
                            : leave.status === 'REJECTED'
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        {leave.status === 'CONFIRMED'
                          ? '승인'
                          : leave.status === 'ON_HOLD'
                          ? '보류'
                          : leave.status === 'REJECTED'
                          ? '거절'
                          : '대기'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 닫기 버튼 */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                닫기
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
