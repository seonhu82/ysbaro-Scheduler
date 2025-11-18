/**
 * 부서장 수동 배치 페이지 (공개)
 * 경로: /manual-assign/[token]
 *
 * 기능:
 * - 토큰 기반 접근 (인증 불필요)
 * - 부서별 직원 배치 캘린더 뷰
 * - 엑셀 템플릿 다운로드/업로드
 * - 배치 제출 기능
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Calendar, Download, Upload, Send, RefreshCw, Building2, List, Grid3x3 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getCalendarGridDates, formatDate, isInMonth, isToday, isWeekend, isSunday } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface Staff {
  id: string
  name: string
  rank: string
  workDays: number
}

interface DaySchedule {
  combinationName?: string
  hasNightShift?: boolean
  doctorShortNames?: string[]
  holidayName?: string | null
}

interface ScheduleData {
  [date: string]: DaySchedule
}

export default function ManualAssignPublicPage({
  params,
}: {
  params: { token: string }
}) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [clinicName, setClinicName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [departmentStaff, setDepartmentStaff] = useState<Staff[]>([])
  const [scheduleData, setScheduleData] = useState<ScheduleData>({})
  const [assignments, setAssignments] = useState<Map<string, string[]>>(new Map())
  const [annualLeaves, setAnnualLeaves] = useState<Map<string, string[]>>(new Map())
  const [expiresAt, setExpiresAt] = useState<string>('')
  const [deployedStartDate, setDeployedStartDate] = useState<string | null>(null)
  const [deployedEndDate, setDeployedEndDate] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list') // 모바일은 기본 리스트

  useEffect(() => {
    fetchData()
  }, [params.token])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/public/manual-assign/${params.token}?year=${year}&month=${month}`)
      const result = await response.json()

      if (result.success) {
        setClinicName(result.data.clinicName)
        setDepartmentName(result.data.departmentName)
        setYear(result.data.year)
        setMonth(result.data.month)
        setDepartmentStaff(result.data.staff)
        setScheduleData(result.data.scheduleData)
        setExpiresAt(result.data.expiresAt)
        setDeployedStartDate(result.data.deployedStartDate)
        setDeployedEndDate(result.data.deployedEndDate)

        // 기존 배치가 있으면 로드
        if (result.data.existingAssignments) {
          const newAssignments = new Map<string, string[]>()
          Object.entries(result.data.existingAssignments).forEach(([date, staffIds]) => {
            newAssignments.set(date, staffIds as string[])
          })
          setAssignments(newAssignments)
        }

        // 기존 연차가 있으면 로드
        if (result.data.existingAnnualLeaves) {
          const newAnnualLeaves = new Map<string, string[]>()
          Object.entries(result.data.existingAnnualLeaves).forEach(([date, staffIds]) => {
            newAnnualLeaves.set(date, staffIds as string[])
          })
          setAnnualLeaves(newAnnualLeaves)
        }
      } else {
        toast({
          title: '오류',
          description: result.error || '데이터를 불러올 수 없습니다.',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Fetch error:', error)
      toast({
        title: '오류 발생',
        description: '서버 오류가 발생했습니다.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // 배포 범위 기반 날짜 생성
  const dates = (() => {
    if (!deployedStartDate || !deployedEndDate) {
      // 배포 범위가 없으면 기존 월 기반 캘린더 사용
      return getCalendarGridDates(year, month)
    }

    // 배포 범위의 날짜들 생성
    const start = new Date(deployedStartDate)
    const end = new Date(deployedEndDate)
    const rangeDates: Date[] = []

    const current = new Date(start)
    while (current <= end) {
      rangeDates.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    // 캘린더 그리드를 위해 주 단위로 확장 (일요일 시작)
    if (rangeDates.length === 0) return []

    const firstDate = rangeDates[0]
    const lastDate = rangeDates[rangeDates.length - 1]

    // 첫 주의 일요일부터 시작
    const startOfFirstWeek = new Date(firstDate)
    startOfFirstWeek.setDate(firstDate.getDate() - firstDate.getDay())

    // 마지막 주의 토요일까지
    const endOfLastWeek = new Date(lastDate)
    endOfLastWeek.setDate(lastDate.getDate() + (6 - lastDate.getDay()))

    const gridDates: Date[] = []
    const gridCurrent = new Date(startOfFirstWeek)

    while (gridCurrent <= endOfLastWeek) {
      gridDates.push(new Date(gridCurrent))
      gridCurrent.setDate(gridCurrent.getDate() + 1)
    }

    return gridDates
  })()

  // 배포 범위 체크 함수
  const isInDeployedRange = (date: Date) => {
    if (!deployedStartDate || !deployedEndDate) {
      // 배포 범위가 없으면 현재 월 기준으로 체크
      return isInMonth(date, year, month)
    }

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const start = new Date(deployedStartDate)
    const end = new Date(deployedEndDate)
    return dateOnly >= start && dateOnly <= end
  }

  // 영업일 체크 (일요일과 공휴일 제외)
  const isBusinessDay = (date: Date) => {
    const key = formatDate(date)
    const schedule = scheduleData[key]

    // 공휴일이면 영업일 아님
    if (schedule?.holidayName) return false

    // 일요일이면 영업일 아님
    if (isSunday(date)) return false

    return true
  }

  const toggleStaffForDay = (date: Date, staffId: string) => {
    const key = formatDate(date)
    const current = assignments.get(key) || []

    if (current.includes(staffId)) {
      // 제거
      const updated = current.filter(id => id !== staffId)
      if (updated.length > 0) {
        setAssignments(new Map(assignments.set(key, updated)))
      } else {
        const newMap = new Map(assignments)
        newMap.delete(key)
        setAssignments(newMap)
      }
    } else {
      // 추가
      setAssignments(new Map(assignments.set(key, [...current, staffId])))
    }
  }

  const toggleAllStaffForDay = (date: Date) => {
    const key = formatDate(date)
    const current = assignments.get(key) || []

    const newAssignments = new Map(assignments)
    if (current.length === departmentStaff.length) {
      newAssignments.set(key, [])
    } else {
      newAssignments.set(key, departmentStaff.map(s => s.id))
    }

    setAssignments(newAssignments)
  }

  const toggleAnnualLeaveForDay = (date: Date, staffId: string) => {
    const key = formatDate(date)
    const current = annualLeaves.get(key) || []

    const newAnnualLeaves = new Map(annualLeaves)
    if (current.includes(staffId)) {
      newAnnualLeaves.set(key, current.filter(id => id !== staffId))
    } else {
      newAnnualLeaves.set(key, [...current, staffId])
    }

    setAnnualLeaves(newAnnualLeaves)
  }

  const handleDownloadTemplate = () => {
    // 설명 행 추가
    const rangeText = deployedStartDate && deployedEndDate
      ? `배포 범위: ${deployedStartDate} ~ ${deployedEndDate}`
      : `${year}년 ${month}월`

    const instructions = [
      [`※ 작성 방법: 근무일에 'O' 표시, 연차에 'A' 표시, 빈칸은 미배치 (${rangeText})`],
      [] // 빈 행
    ]

    // 헤더 행
    const headers = ['날짜', '요일', ...departmentStaff.map(s => s.rank ? `${s.name}(${s.rank})` : s.name)]

    // 데이터 행 (배포 범위 내의 영업일만)
    const dataRows = dates
      .filter(d => isInDeployedRange(d) && isBusinessDay(d))
      .map(d => [
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        WEEKDAYS[d.getDay()],
        ...departmentStaff.map(() => '')
      ])

    // 전체 데이터 결합
    const allData = [...instructions, headers, ...dataRows]

    const ws = XLSX.utils.aoa_to_sheet(allData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${departmentName}_${month}월`)
    XLSX.writeFile(wb, `${departmentName}_${year}년${month}월_근무표.xlsx`)

    toast({
      title: '템플릿 다운로드 완료',
      description: '엑셀 파일에 근무일에 O를 표시하여 업로드하세요.'
    })
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      // 3번째 행(index 2)부터 읽기 (설명 행, 빈 행 건너뛰기)
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { range: 2 })

      const newAssignments = new Map<string, string[]>()
      const newAnnualLeaves = new Map<string, string[]>()

      jsonData.forEach((row: any) => {
        const dateStr = row['날짜']
        if (!dateStr) return

        const assignedStaffIds: string[] = []
        const annualLeaveStaffIds: string[] = []

        departmentStaff.forEach(staff => {
          const key = staff.rank ? `${staff.name}(${staff.rank})` : staff.name
          const value = row[key]
          if (value === 'O' || value === 'o' || value === '○') {
            assignedStaffIds.push(staff.id)
          } else if (value === 'A' || value === 'a') {
            annualLeaveStaffIds.push(staff.id)
          }
        })

        if (assignedStaffIds.length > 0) {
          newAssignments.set(dateStr, assignedStaffIds)
        }
        if (annualLeaveStaffIds.length > 0) {
          newAnnualLeaves.set(dateStr, annualLeaveStaffIds)
        }
      })

      // 기존 데이터와 병합 (덮어쓰지 않고 추가)
      const mergedAssignments = new Map(assignments)
      newAssignments.forEach((value, key) => {
        mergedAssignments.set(key, value)
      })

      const mergedAnnualLeaves = new Map(annualLeaves)
      newAnnualLeaves.forEach((value, key) => {
        mergedAnnualLeaves.set(key, value)
      })

      setAssignments(mergedAssignments)
      setAnnualLeaves(mergedAnnualLeaves)

      toast({
        title: '업로드 완료',
        description: `${newAssignments.size}개 날짜의 배치가 추가되었습니다. (전체: ${mergedAssignments.size}개)`
      })
    } catch (error) {
      console.error('Excel upload error:', error)
      toast({
        title: '업로드 실패',
        description: '엑셀 파일 형식을 확인해주세요.',
        variant: 'destructive'
      })
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)

      // Map을 배열로 변환
      const assignmentsArray = Array.from(assignments.entries()).map(([date, staffIds]) => ({
        date,
        staffIds
      }))

      const annualLeavesArray = Array.from(annualLeaves.entries()).map(([date, staffIds]) => ({
        date,
        staffIds
      }))

      const response = await fetch(`/api/public/manual-assign/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: assignmentsArray,
          annualLeaves: annualLeavesArray
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '제출 완료',
          description: result.data.message || '배치가 성공적으로 저장되었습니다.'
        })
      } else {
        toast({
          title: '제출 실패',
          description: result.error || '배치 저장에 실패했습니다.',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast({
        title: '오류 발생',
        description: '서버 오류가 발생했습니다.',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-3 sm:p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-3 animate-spin text-blue-500" />
          <p className="text-sm sm:text-base text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6">
      {/* 헤더 */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-start gap-3 mb-2">
          <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h1 className="text-xl sm:text-3xl font-bold leading-tight">{departmentName} 부서 근무표 작성</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">{clinicName}</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-gray-500">
          {deployedStartDate && deployedEndDate ? (
            <>배포 범위: {deployedStartDate} ~ {deployedEndDate} • 링크 만료일: {new Date(expiresAt).toLocaleDateString()}</>
          ) : (
            <>{year}년 {month}월 • 링크 만료일: {new Date(expiresAt).toLocaleDateString()}</>
          )}
        </p>
      </div>

      {/* 안내 메시지 */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2 text-sm sm:text-base">작성 안내</h3>
              <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                <li>• 영업일(평일)에만 배치를 설정할 수 있습니다.</li>
                <li>• 엑셀 또는 {viewMode === 'list' ? '리스트' : '캘린더'}에서 직접 선택하세요.</li>
                <li>• <strong className="text-gray-600">근무</strong> 또는 <strong className="text-blue-600">연차</strong>를 선택할 수 있습니다.</li>
                <li>• 작성 완료 후 "제출하기" 버튼을 눌러 저장하세요.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 도구 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Button onClick={handleDownloadTemplate} className="flex-1" variant="outline" size="lg">
          <Download className="w-5 h-5 mr-2" />
          엑셀 템플릿
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1"
          variant="outline"
          size="lg"
        >
          <Upload className="w-5 h-5 mr-2" />
          엑셀 업로드
        </Button>
        <Button
          onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
          className="flex-1 sm:flex-none sm:w-auto"
          variant="outline"
          size="lg"
        >
          {viewMode === 'calendar' ? (
            <>
              <List className="w-5 h-5 mr-2" />
              리스트
            </>
          ) : (
            <>
              <Grid3x3 className="w-5 h-5 mr-2" />
              캘린더
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* 캘린더 / 리스트 뷰 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-base sm:text-lg">
              {deployedStartDate && deployedEndDate ? (
                <>{deployedStartDate} ~ {deployedEndDate} 근무표</>
              ) : (
                <>{year}년 {month}월 근무표</>
              )}
            </span>
            <Badge variant="outline" className="text-base w-fit">
              총 {assignments.size}일 배치됨
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {viewMode === 'list' ? (
            /* 리스트 뷰 (모바일 친화적) */
            <div className="space-y-3">
              {dates
                .filter(d => isInDeployedRange(d) && isBusinessDay(d))
                .map((date) => {
                  const dateKey = formatDate(date)
                  const schedule = scheduleData[dateKey]
                  const assignedStaffIds = assignments.get(dateKey) || []
                  const annualLeaveStaffIds = annualLeaves.get(dateKey) || []
                  const today = isToday(date)
                  const weekend = isWeekend(date)

                  return (
                    <Card key={dateKey} className={cn(
                      "border-2",
                      today && "border-blue-500 bg-blue-50",
                      weekend && !today && "bg-red-50/30"
                    )}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={cn(
                              "text-lg font-bold",
                              today && "text-blue-600",
                              weekend && !today && "text-red-600"
                            )}>
                              {date.getMonth() + 1}월 {date.getDate()}일 ({WEEKDAYS[date.getDay()]})
                            </div>
                            {/* 원장 스케줄 */}
                            {schedule && (
                              <div className="mt-1">
                                {schedule.holidayName ? (
                                  <Badge variant="destructive" className="text-xs">
                                    {schedule.holidayName}
                                  </Badge>
                                ) : schedule.combinationName ? (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {schedule.combinationName}
                                    </Badge>
                                    {schedule.hasNightShift && (
                                      <span className="text-sm" title="야간">🌙</span>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-base">
                            {assignedStaffIds.length}/{departmentStaff.length}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {/* 전체 선택 */}
                        <label className="flex items-center gap-2 p-3 mb-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                          <Checkbox
                            checked={assignedStaffIds.length === departmentStaff.length && departmentStaff.length > 0}
                            onCheckedChange={() => toggleAllStaffForDay(date)}
                            className="w-5 h-5"
                          />
                          <span className="font-semibold text-base">전체 선택</span>
                        </label>

                        {/* 직원 목록 */}
                        <div className="space-y-2">
                          {departmentStaff.map(staff => {
                            const isAssigned = assignedStaffIds.includes(staff.id)
                            const isAnnualLeave = annualLeaveStaffIds.includes(staff.id)

                            return (
                              <div
                                key={staff.id}
                                className="flex items-center gap-3 p-3 border rounded-lg bg-white"
                              >
                                <label className="flex items-center gap-2 cursor-pointer" title="근무">
                                  <Checkbox
                                    checked={isAssigned}
                                    onCheckedChange={() => toggleStaffForDay(date, staff.id)}
                                    disabled={isAnnualLeave}
                                    className="w-5 h-5"
                                  />
                                  <span className="text-sm font-medium text-gray-600">근무</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer" title="연차">
                                  <Checkbox
                                    checked={isAnnualLeave}
                                    onCheckedChange={() => toggleAnnualLeaveForDay(date, staff.id)}
                                    disabled={isAssigned}
                                    className="w-5 h-5"
                                  />
                                  <span className="text-sm font-medium text-blue-600">연차</span>
                                </label>
                                <span className="flex-1 text-base font-medium">{staff.name}</span>
                                {staff.rank && <Badge variant="outline" className="text-xs">{staff.rank}</Badge>}
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          ) : (
            /* 캘린더 뷰 (기존) */
            <>
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-2 mb-2">
            {WEEKDAYS.map((day, index) => (
              <div
                key={index}
                className={cn(
                  'text-center font-semibold py-2',
                  index === 0 && 'text-red-600',
                  index === 6 && 'text-blue-600'
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-2">
            {dates.map((date, index) => {
              const dateKey = formatDate(date)
              const schedule = scheduleData[dateKey]
              const inRange = isInDeployedRange(date)
              const today = isToday(date)
              const weekend = isWeekend(date)
              const sunday = isSunday(date)
              const businessDay = isBusinessDay(date)
              const assignedStaffIds = assignments.get(dateKey) || []

              return (
                <div
                  key={index}
                  className={cn(
                    'min-h-[180px] p-2 border border-gray-200 flex flex-col',
                    !inRange && 'bg-gray-50/50',
                    today && 'bg-blue-50 border-blue-300',
                    weekend && inRange && businessDay && 'bg-red-50/30',
                    !businessDay && inRange && 'bg-gray-100/80'
                  )}
                >
                  {/* 날짜 헤더 */}
                  <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        !inRange && 'text-gray-400',
                        sunday && inRange && 'text-red-600',
                        weekend && !sunday && inRange && 'text-blue-600'
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {assignedStaffIds.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {assignedStaffIds.length}/{departmentStaff.length}
                      </Badge>
                    )}
                  </div>

                  {/* 원장 스케줄 표시 */}
                  {schedule && inRange && (
                    <div className="mb-2 space-y-1">
                      {schedule.holidayName ? (
                        <div className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 border border-red-300">
                          {schedule.holidayName}
                        </div>
                      ) : schedule.combinationName ? (
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                            {schedule.combinationName}
                          </span>
                          {schedule.hasNightShift && (
                            <span className="text-xs" title="야간">🌙</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* 휴무일 또는 영업일 표시 */}
                  {inRange && !businessDay ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xs text-gray-500 font-medium">
                        {schedule?.holidayName ? '공휴일' : '휴무일'}
                      </p>
                    </div>
                  ) : inRange ? (
                    /* 직원 선택 체크박스 - 영업일만 */
                    <div className="flex-1 flex flex-col min-h-0">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer hover:text-gray-900 mb-1 flex-shrink-0">
                        <Checkbox
                          checked={assignedStaffIds.length === departmentStaff.length && departmentStaff.length > 0}
                          onCheckedChange={() => toggleAllStaffForDay(date)}
                        />
                        <span className="font-medium">전체 선택</span>
                      </label>

                      <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                        {departmentStaff.map(staff => {
                          const annualLeaveStaffIds = annualLeaves.get(dateKey) || []
                          const isAssigned = assignedStaffIds.includes(staff.id)
                          const isAnnualLeave = annualLeaveStaffIds.includes(staff.id)

                          return (
                            <div
                              key={staff.id}
                              className="flex items-center gap-1.5 text-xs hover:bg-gray-50 p-0.5 rounded"
                            >
                              <label className="flex items-center gap-1 cursor-pointer" title="근무">
                                <Checkbox
                                  checked={isAssigned}
                                  onCheckedChange={() => toggleStaffForDay(date, staff.id)}
                                  disabled={isAnnualLeave}
                                />
                                <span className="text-[10px] text-gray-500">O</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer" title="연차">
                                <Checkbox
                                  checked={isAnnualLeave}
                                  onCheckedChange={() => toggleAnnualLeaveForDay(date, staff.id)}
                                  disabled={isAssigned}
                                />
                                <span className="text-[10px] text-blue-600">A</span>
                              </label>
                              <span className="flex-1 truncate">{staff.name}</span>
                              {staff.rank && <span className="text-[10px] text-gray-500">{staff.rank}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 제출 버튼 */}
      <div className="sticky bottom-0 left-0 right-0 p-3 sm:p-0 sm:relative bg-white border-t sm:border-t-0 -mx-3 sm:mx-0 mt-4 sm:mt-0">
        <Button
          onClick={handleSubmit}
          disabled={submitting || assignments.size === 0}
          size="lg"
          className="w-full sm:w-auto sm:min-w-[200px] sm:float-right text-base sm:text-sm"
        >
          {submitting ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              제출 중...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              제출하기 ({assignments.size}일)
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
