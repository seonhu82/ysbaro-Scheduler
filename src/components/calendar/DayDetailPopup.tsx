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
import { Calendar, Users, UserPlus, Edit, Save, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Doctor {
  id: string
  name: string
}

interface StaffMember {
  id: string
  name: string
  rank: string
  categoryName?: string
  departmentName?: string
}

interface DaySchedule {
  id?: string
  date: string
  doctors: Doctor[]
  staff: StaffMember[]
  annualLeave?: StaffMember[]
  offDays?: StaffMember[]
  isNightShift: boolean
}

interface DayDetailPopupProps {
  date: Date | null
  isOpen: boolean
  onClose: () => void
  onSave?: (schedule: DaySchedule) => Promise<void>
  year?: number
  month?: number
  status?: 'DRAFT' | 'DEPLOYED'
}

export function DayDetailPopup({
  date,
  isOpen,
  onClose,
  onSave,
  year,
  month,
  status,
}: DayDetailPopupProps) {
  const [schedule, setSchedule] = useState<DaySchedule | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([])
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<string>('')
  const [selectedStaff, setSelectedStaff] = useState<string>('')

  // 스케줄 데이터 로딩
  useEffect(() => {
    console.log('🔍 DayDetailPopup useEffect triggered:', { date, isOpen, year, month, status })
    if (!date || !isOpen) {
      console.log('❌ Early return - no date or not open')
      return
    }

    const fetchDaySchedule = async () => {
      setLoading(true)
      try {
        // 시간대 문제 해결: 로컬 날짜를 YYYY-MM-DD 형식으로 변환
        const localYear = date.getFullYear()
        const localMonth = String(date.getMonth() + 1).padStart(2, '0')
        const localDay = String(date.getDate()).padStart(2, '0')
        const dateStr = `${localYear}-${localMonth}-${localDay}`

        // API URL 구성
        let apiUrl = `/api/schedule/day?date=${dateStr}`
        if (year && month) {
          apiUrl += `&year=${year}&month=${month}`
        }
        if (status) {
          apiUrl += `&status=${status}`
        }

        const [scheduleRes, doctorsRes, staffRes] = await Promise.all([
          fetch(apiUrl),
          fetch('/api/doctors'),
          fetch('/api/staff')
        ])

        const [scheduleResult, doctorsResult, staffResult] = await Promise.all([
          scheduleRes.json(),
          doctorsRes.json(),
          staffRes.json()
        ])

        console.log('Schedule result:', scheduleResult)
        console.log('Full data object:', JSON.stringify(scheduleResult.data, null, 2))

        if (scheduleResult.success && scheduleResult.data) {
          console.log('Annual leave:', scheduleResult.data.annualLeave)
          console.log('Off days:', scheduleResult.data.offDays)

          setSchedule({
            id: scheduleResult.data.id,
            date: scheduleResult.data.date,
            doctors: scheduleResult.data.doctors || [],
            staff: scheduleResult.data.staff || [],
            annualLeave: scheduleResult.data.annualLeave || [],
            offDays: scheduleResult.data.offDays || [],
            isNightShift: scheduleResult.data.isNightShift || false,
          })
        } else {
          // 데이터가 없으면 빈 스케줄
          setSchedule({
            date: dateStr,
            doctors: [],
            staff: [],
            annualLeave: [],
            offDays: [],
            isNightShift: false,
          })
        }

        // 사용 가능한 원장과 직원 목록 저장
        if (doctorsResult.success) {
          setAvailableDoctors(doctorsResult.data || [])
        }
        if (staffResult.success) {
          // 진료실 소속이면서 카테고리가 있는 활성 직원만 필터링
          setAvailableStaff(
            staffResult.data.filter((s: any) =>
              s.isActive &&
              s.departmentName === '진료실' &&
              s.categoryName
            ) || []
          )
        }
      } catch (error) {
        console.error('Failed to fetch day schedule:', error)
        // 에러 시에도 빈 스케줄 표시
        setSchedule({
          date: date.toISOString().split('T')[0],
          doctors: [],
          staff: [],
          annualLeave: [],
          offDays: [],
          isNightShift: false,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDaySchedule()
  }, [date, isOpen, year, month, status])

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
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <Select
                    value={selectedDoctor}
                    onValueChange={(value) => {
                      setSelectedDoctor(value)
                      if (value && schedule) {
                        const doctor = availableDoctors.find(d => d.id === value)
                        if (doctor && !schedule.doctors.find(d => d.id === doctor.id)) {
                          setSchedule({
                            ...schedule,
                            doctors: [...schedule.doctors, doctor]
                          })
                        }
                      }
                      setSelectedDoctor('')
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="원장 추가하기" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDoctors
                        .filter(d => !schedule?.doctors.find(sd => sd.id === d.id))
                        .map(doctor => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {schedule?.doctors && schedule.doctors.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {schedule.doctors.map((doctor) => (
                        <Badge key={doctor.id} variant="default" className="flex items-center gap-1">
                          {doctor.name}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-red-500"
                            onClick={() => {
                              setSchedule({
                                ...schedule,
                                doctors: schedule.doctors.filter(d => d.id !== doctor.id)
                              })
                            }}
                          />
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">원장이 배정되지 않았습니다</p>
                  )}
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* 근무 직원 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  근무 직원 ({schedule?.staff?.length || 0}명)
                </h3>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <Select
                    value={selectedStaff}
                    onValueChange={(value) => {
                      setSelectedStaff(value)
                      if (value && schedule) {
                        const staff = availableStaff.find(s => s.id === value)
                        if (staff && !schedule.staff.find(s => s.id === staff.id)) {
                          setSchedule({
                            ...schedule,
                            staff: [...schedule.staff, staff]
                          })
                        }
                      }
                      setSelectedStaff('')
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="직원 추가하기" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStaff
                        .filter(s => !schedule?.staff.find(ss => ss.id === s.id))
                        .map(staff => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name} ({staff.categoryName || staff.rank})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
                              {staff.categoryName || staff.rank}
                            </Badge>
                          </div>
                          <X
                            className="w-4 h-4 cursor-pointer hover:text-red-500"
                            onClick={() => {
                              setSchedule({
                                ...schedule,
                                staff: schedule.staff.filter(s => s.id !== staff.id)
                              })
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">배치된 직원이 없습니다</p>
                  )}
                </div>
              ) : (
                <>
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
                              {staff.categoryName || staff.rank}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">배치된 직원이 없습니다</p>
                  )}
                </>
              )}
            </div>

            {/* 연차 */}
            {schedule?.annualLeave && schedule.annualLeave.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    연차 ({schedule.annualLeave.length}명)
                  </h3>
                </div>
                <div className="space-y-2">
                  {schedule.annualLeave.map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200"
                    >
                      <div>
                        <span className="font-medium">{staff.name}</span>
                        <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-700 border-blue-300">
                          연차
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 오프 */}
            {schedule?.offDays && schedule.offDays.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    오프 ({schedule.offDays.length}명)
                  </h3>
                </div>
                <div className="space-y-2">
                  {schedule.offDays.map((staff) => (
                    <div
                      key={staff.id}
                      className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200"
                    >
                      <div>
                        <span className="font-medium">{staff.name}</span>
                        <Badge variant="outline" className="ml-2 bg-green-100 text-green-700 border-green-300">
                          오프
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
