'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateWithDay, isSunday, isWeekend } from '@/lib/date-utils'
import { Calendar, Users, UserPlus, Edit, Save } from 'lucide-react'

interface Doctor {
  id: string
  name: string
}

interface StaffMember {
  id: string
  name: string
  rank: string
}

interface DaySchedule {
  id?: string
  date: string
  doctors: Doctor[]
  staff: StaffMember[]
  isNightShift: boolean
}

interface DayDetailPopupProps {
  date: Date | null
  isOpen: boolean
  onClose: () => void
  onSave?: (schedule: DaySchedule) => Promise<void>
}

export function DayDetailPopup({
  date,
  isOpen,
  onClose,
  onSave,
}: DayDetailPopupProps) {
  const [schedule, setSchedule] = useState<DaySchedule | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // 스케줄 데이터 로딩
  useEffect(() => {
    if (!date || !isOpen) return

    const fetchDaySchedule = async () => {
      setLoading(true)
      try {
        // TODO: API 호출로 날짜별 스케줄 데이터 가져오기
        // const response = await fetch(`/api/schedule/day?date=${formatDate(date)}`)
        // const result = await response.json()

        // 임시 데이터
        setSchedule({
          date: date.toISOString(),
          doctors: [],
          staff: [],
          isNightShift: false,
        })
      } catch (error) {
        console.error('Failed to fetch day schedule:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDaySchedule()
  }, [date, isOpen])

  const handleSave = async () => {
    if (!schedule || !onSave) return

    try {
      setLoading(true)
      await onSave(schedule)
      setIsEditing(false)
      onClose()
    } catch (error) {
      console.error('Failed to save schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!date) return null

  const sunday = isSunday(date)
  const weekend = isWeekend(date)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {formatDateWithDay(date)}
            {sunday && (
              <Badge variant="destructive" className="ml-2">
                휴무
              </Badge>
            )}
            {weekend && !sunday && (
              <Badge variant="secondary" className="ml-2">
                주말
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            날짜별 스케줄을 확인하고 관리합니다
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 원장 목록 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  근무 원장
                </h3>
                {isEditing && (
                  <Button size="sm" variant="outline">
                    <UserPlus className="w-4 h-4 mr-1" />
                    원장 추가
                  </Button>
                )}
              </div>
              {schedule?.doctors && schedule.doctors.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {schedule.doctors.map((doctor) => (
                    <Badge key={doctor.id} variant="default">
                      {doctor.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">원장이 배정되지 않았습니다</p>
              )}
            </div>

            {/* 직원 배치 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  직원 배치 ({schedule?.staff?.length || 0}명)
                </h3>
                {isEditing && (
                  <Button size="sm" variant="outline">
                    <UserPlus className="w-4 h-4 mr-1" />
                    직원 추가
                  </Button>
                )}
              </div>
              {schedule?.staff && schedule.staff.length > 0 ? (
                <div className="space-y-2">
                  {schedule.staff.map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div>
                        <span className="font-medium">{staff.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {staff.rank}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">배치된 직원이 없습니다</p>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              {!isEditing ? (
                <>
                  <Button variant="outline" onClick={onClose}>
                    닫기
                  </Button>
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" />
                    편집
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={loading}
                  >
                    취소
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    <Save className="w-4 h-4 mr-1" />
                    {loading ? '저장 중...' : '저장'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
