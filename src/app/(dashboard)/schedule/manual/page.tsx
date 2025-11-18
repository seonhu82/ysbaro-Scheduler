'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar, Users, Save, ChevronLeft, ChevronRight, AlertCircle, Download, Upload, Link as LinkIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { getCalendarGridDates, isInMonth, formatDate, isToday, isWeekend, isSunday } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

interface Department {
  id: string
  name: string
  useAutoAssignment: boolean
}

interface Staff {
  id: string
  name: string
  rank: string
  departmentName: string
  categoryName: string | null
}

interface DaySchedule {
  combinationName?: string
  hasNightShift?: boolean
  doctorShortNames?: string[]
  holidayName?: string | null
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function ManualAssignmentPage() {
  const { toast } = useToast()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [allStaff, setAllStaff] = useState<Staff[]>([])
  const [departmentStaff, setDepartmentStaff] = useState<Staff[]>([])

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [scheduleData, setScheduleData] = useState<Record<string, DaySchedule>>({})
  const [assignments, setAssignments] = useState<Map<string, string[]>>(new Map())
  const [annualLeaves, setAnnualLeaves] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null)
  const [generatingUrl, setGeneratingUrl] = useState(false)
  const [deployedStartDate, setDeployedStartDate] = useState<Date | null>(null)
  const [deployedEndDate, setDeployedEndDate] = useState<Date | null>(null)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1

  // 부서 및 직원 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        const deptResponse = await fetch('/api/settings/departments')
        const deptData = await deptResponse.json()

        let deptList: Department[] = []
        if (Array.isArray(deptData)) {
          deptList = deptData
        } else if (deptData?.success && deptData?.data) {
          deptList = deptData.data
        }

        const manualDepartments = deptList.filter(d => !d.useAutoAssignment)
        setDepartments(manualDepartments)

        const staffResponse = await fetch('/api/staff')
        const staffResult = await staffResponse.json()

        if (staffResult.success && Array.isArray(staffResult.data)) {
          setAllStaff(staffResult.data)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
        toast({
          title: '데이터 로드 실패',
          description: '부서 또는 직원 정보를 불러오는데 실패했습니다.',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [toast])

  // 부서 목록이 로드되면 첫 번째 수동배치 부서 자동 선택
  useEffect(() => {
    if (departments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(departments[0])
    }
  }, [departments, selectedDepartment])

  // 스케줄 및 기존 배치 데이터 로드
  const fetchScheduleData = async () => {
    try {
      // 스케줄 정보 (배포 범위 포함) 조회
      const scheduleResponse = await fetch(`/api/schedule/status?year=${year}&month=${month}`, { cache: 'no-store' })
      const scheduleResult = await scheduleResponse.json()

      if (scheduleResult.success && scheduleResult.schedule) {
        const schedule = scheduleResult.schedule
        // 수동배치는 DEPLOYED 상태이고 배포 범위가 설정된 스케줄만 허용
        if (schedule.status === 'DEPLOYED' && schedule.deployedStartDate && schedule.deployedEndDate) {
          setDeployedStartDate(new Date(schedule.deployedStartDate))
          setDeployedEndDate(new Date(schedule.deployedEndDate))
        } else {
          // DEPLOYED가 아니거나 배포 범위가 없으면 사용 불가
          setDeployedStartDate(null)
          setDeployedEndDate(null)
        }
      } else {
        // 스케줄이 없으면 배포 범위도 없음
        setDeployedStartDate(null)
        setDeployedEndDate(null)
      }

      // 월간 뷰 데이터 조회 (캘린더 조합명 표시용)
      // status를 지정하지 않으면 기본값으로 DEPLOYED만 조회됨
      // 배포 범위가 다른 월로 넘어가는 경우를 위해 status=DEPLOYED 명시
      const response = await fetch(`/api/schedule/monthly-view?year=${year}&month=${month}&status=DEPLOYED`, { cache: 'no-store' })
      const result = await response.json()

      if (result.success && result.scheduleData) {
        setScheduleData(result.scheduleData)
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error)
    }
  }

  useEffect(() => {
    fetchScheduleData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  // 선택된 부서의 직원 필터링
  useEffect(() => {
    if (selectedDepartment) {
      const filtered = allStaff.filter(s => s.departmentName === selectedDepartment)
      setDepartmentStaff(filtered)
    } else {
      setDepartmentStaff([])
    }
  }, [selectedDepartment, allStaff])

  // 부서가 변경되거나 직원 목록이 로드되면 기존 배치 데이터 다시 로드
  useEffect(() => {
    const loadDepartmentAssignments = async () => {
      if (!selectedDepartment || departmentStaff.length === 0) {
        setAssignments(new Map())
        setAnnualLeaves(new Map())
        return
      }

      try {
        // 배치 및 연차 데이터 조회
        const calendarStart = new Date(year, month - 1, 1)
        const calendarEnd = new Date(year, month, 0)

        const [assignmentsRes, leavesRes] = await Promise.all([
          fetch(`/api/schedule/monthly-view?year=${year}&month=${month}&status=DEPLOYED&departmentType=manual`, { cache: 'no-store' }),
          fetch(
            `/api/leave/list?startDate=${calendarStart.toISOString().split('T')[0]}&endDate=${calendarEnd.toISOString().split('T')[0]}`,
            { cache: 'no-store' }
          )
        ])

        const assignmentsResult = await assignmentsRes.json()
        const leavesResult = await leavesRes.json()

        console.log('📊 수동배치 데이터 로딩:', {
          부서: selectedDepartment,
          년월: `${year}-${month}`,
          부서직원수: departmentStaff.length,
          배치API성공: assignmentsResult.success,
          배치데이터수: assignmentsResult.staffAssignments?.length || 0,
          연차API성공: leavesResult.success,
          연차데이터수: leavesResult.leaves?.length || 0
        })

        const newAssignments = new Map<string, string[]>()
        const newAnnualLeaves = new Map<string, string[]>()

        // 해당 부서 직원들의 ID 목록
        const deptStaffIds = departmentStaff.map(s => s.id)

        // 배치 데이터 처리
        if (assignmentsResult.success && assignmentsResult.staffAssignments) {
          assignmentsResult.staffAssignments.forEach((assignment: any) => {
            if (deptStaffIds.includes(assignment.staffId) && assignment.shiftType !== 'OFF') {
              const dateKey = formatDate(new Date(assignment.date))
              if (!newAssignments.has(dateKey)) {
                newAssignments.set(dateKey, [])
              }
              newAssignments.get(dateKey)!.push(assignment.staffId)
            }
          })
        }

        // 연차 데이터 처리
        if (leavesResult.success && leavesResult.leaves) {
          leavesResult.leaves.forEach((leave: any) => {
            if (
              deptStaffIds.includes(leave.staffId) &&
              leave.leaveType === 'ANNUAL' &&
              (leave.status === 'CONFIRMED' || leave.status === 'ON_HOLD')
            ) {
              const dateKey = formatDate(new Date(leave.date))
              if (!newAnnualLeaves.has(dateKey)) {
                newAnnualLeaves.set(dateKey, [])
              }
              newAnnualLeaves.get(dateKey)!.push(leave.staffId)
            }
          })
        }

        console.log('✅ 수동배치 데이터 처리 완료:', {
          배치된날짜수: newAssignments.size,
          연차날짜수: newAnnualLeaves.size,
          샘플배치: Array.from(newAssignments.entries()).slice(0, 3)
        })

        setAssignments(newAssignments)
        setAnnualLeaves(newAnnualLeaves)
      } catch (error) {
        console.error('Failed to load department assignments:', error)
      }
    }

    loadDepartmentAssignments()
  }, [selectedDepartment, departmentStaff, year, month])

  // 배포 범위 기반 날짜 생성
  const dates = (() => {
    if (!deployedStartDate || !deployedEndDate) {
      // 배포 범위가 없으면 기존 월 기반 캘린더 사용
      return getCalendarGridDates(year, month)
    }

    // 배포 범위의 날짜들 생성
    const rangeDates: Date[] = []
    const current = new Date(deployedStartDate)

    while (current <= deployedEndDate) {
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

  const getDateKey = (date: Date) => {
    return formatDate(date)
  }

  // 배포 범위 내 날짜인지 체크
  const isInDeployedRange = (date: Date) => {
    if (!deployedStartDate || !deployedEndDate) return false

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const startOnly = new Date(deployedStartDate.getFullYear(), deployedStartDate.getMonth(), deployedStartDate.getDate())
    const endOnly = new Date(deployedEndDate.getFullYear(), deployedEndDate.getMonth(), deployedEndDate.getDate())

    return dateOnly >= startOnly && dateOnly <= endOnly
  }

  // 영업일 체크 (일요일과 공휴일 제외)
  const isBusinessDay = (date: Date) => {
    const key = getDateKey(date)
    const schedule = scheduleData[key]

    // 공휴일이면 영업일 아님
    if (schedule?.holidayName) return false

    // 일요일이면 영업일 아님
    if (isSunday(date)) return false

    return true
  }

  const toggleStaffForDay = (date: Date, staffId: string) => {
    const key = getDateKey(date)
    const current = assignments.get(key) || []

    const newAssignments = new Map(assignments)
    if (current.includes(staffId)) {
      newAssignments.set(key, current.filter(id => id !== staffId))
    } else {
      newAssignments.set(key, [...current, staffId])
    }

    setAssignments(newAssignments)
  }

  const toggleAllStaffForDay = (date: Date) => {
    const key = getDateKey(date)
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
    const key = getDateKey(date)
    const current = annualLeaves.get(key) || []

    const newAnnualLeaves = new Map(annualLeaves)
    if (current.includes(staffId)) {
      newAnnualLeaves.set(key, current.filter(id => id !== staffId))
    } else {
      newAnnualLeaves.set(key, [...current, staffId])
    }

    setAnnualLeaves(newAnnualLeaves)
  }

  // 엑셀 템플릿 다운로드
  const handleDownloadTemplate = () => {
    if (!selectedDepartment) {
      toast({
        title: '부서 미선택',
        description: '먼저 부서를 선택해주세요.',
        variant: 'destructive'
      })
      return
    }

    // 배포 범위를 직접 사용 (scheduleData는 현재 월 캘린더 그리드 범위만 포함하므로 부정확)
    const startDate = deployedStartDate ? new Date(deployedStartDate) : dates[0]
    const endDate = deployedEndDate ? new Date(deployedEndDate) : dates[dates.length - 1]

    console.log('📊 엑셀 다운로드 - 배치 상태 확인:', {
      의사배치범위: `${formatDate(startDate)} ~ ${formatDate(endDate)}`,
      저장된배치건수: assignments.size,
      저장된연차건수: annualLeaves.size,
      배치날짜목록: Array.from(assignments.keys()),
      연차날짜목록: Array.from(annualLeaves.keys())
    })

    // 이미 배치된 날짜 제외 (assignments 또는 annualLeaves에 데이터가 있는 날짜)
    const unassignedDates = dates.filter(d => {
      if (d < startDate || d > endDate || !isInDeployedRange(d) || !isBusinessDay(d)) {
        return false
      }

      const dateKey = formatDate(d)
      const hasAssignment = assignments.has(dateKey) && (assignments.get(dateKey)?.length || 0) > 0
      const hasAnnualLeave = annualLeaves.has(dateKey) && (annualLeaves.get(dateKey)?.length || 0) > 0

      if (hasAssignment || hasAnnualLeave) {
        console.log(`⏭️  제외: ${dateKey} (배치: ${hasAssignment}, 연차: ${hasAnnualLeave})`)
      }

      // 배치나 연차 데이터가 없는 날짜만 포함
      return !hasAssignment && !hasAnnualLeave
    })

    console.log('📋 엑셀에 포함될 날짜:', unassignedDates.map(d => formatDate(d)))

    if (unassignedDates.length === 0) {
      toast({
        title: '배치 완료',
        description: '의사 배치가 배포 범위 끝까지 완료되었습니다.',
        variant: 'destructive'
      })
      return
    }

    const rangeText = `의사 배치 범위: ${formatDate(unassignedDates[0])} ~ ${formatDate(unassignedDates[unassignedDates.length - 1])}`

    // 설명 행 추가
    const instructions = [
      [`※ 작성 방법: 근무일에 'O' 표시, 연차에 'A' 표시, 빈칸은 미배치 (${rangeText})`],
      [] // 빈 행
    ]

    // 헤더 행
    const headers = ['날짜', '요일', ...departmentStaff.map(s => s.rank ? `${s.name}(${s.rank})` : s.name)]

    // 데이터 행 (배치되지 않은 영업일만)
    const dataRows = unassignedDates.map(d => [
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        WEEKDAYS[d.getDay()],
        ...departmentStaff.map(() => '')
      ])

    // 전체 데이터 결합
    const allData = [...instructions, headers, ...dataRows]

    const ws = XLSX.utils.aoa_to_sheet(allData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${selectedDepartment}_${month}월`)
    XLSX.writeFile(wb, `${selectedDepartment}_${year}년${month}월_근무표.xlsx`)

    toast({
      title: '템플릿 다운로드 완료',
      description: '엑셀 파일에 근무일에 O를 표시하여 업로드하세요.'
    })
  }

  // 엑셀 업로드
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

    // 파일 input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 부서장 전용 URL 생성
  const handleGenerateUrl = async () => {
    if (!selectedDepartment) {
      toast({
        title: '부서 미선택',
        description: '먼저 부서를 선택해주세요.',
        variant: 'destructive'
      })
      return
    }

    try {
      setGeneratingUrl(true)

      const response = await fetch('/api/deploy/manual-assign-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentName: selectedDepartment,
          expiryDays: 365
        })
      })

      const result = await response.json()

      if (result.success) {
        const url = result.data.publicUrl
        setDeploymentUrl(url)

        // 클립보드 복사
        await navigator.clipboard.writeText(url)

        toast({
          title: 'URL 생성 완료',
          description: '부서장 전용 URL이 클립보드에 복사되었습니다.'
        })
      } else {
        toast({
          title: 'URL 생성 실패',
          description: result.error || 'URL 생성에 실패했습니다.',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('URL generation error:', error)
      toast({
        title: 'URL 생성 실패',
        description: 'URL 생성 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
    } finally {
      setGeneratingUrl(false)
    }
  }

  // 저장
  const handleSave = async () => {
    if (!selectedDepartment) {
      toast({
        title: '부서 미선택',
        description: '부서를 먼저 선택해주세요.',
        variant: 'destructive'
      })
      return
    }

    try {
      setSaving(true)

      const assignmentList = Array.from(assignments.entries())
        .filter(([_, staffIds]) => staffIds.length > 0)
        .map(([dateKey, staffIds]) => ({
          date: dateKey,
          staffIds
        }))

      const annualLeaveList = Array.from(annualLeaves.entries())
        .filter(([_, staffIds]) => staffIds.length > 0)
        .map(([dateKey, staffIds]) => ({
          date: dateKey,
          staffIds
        }))

      const response = await fetch('/api/schedule/manual-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          month,
          departmentName: selectedDepartment,
          assignments: assignmentList,
          annualLeaves: annualLeaveList
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '저장 완료',
          description: `${result.data.created}개의 배치가 저장되었습니다.`
        })

        // 저장된 데이터를 다시 로드
        await fetchScheduleData()
      } else {
        toast({
          title: '저장 실패',
          description: result.error || '배치 저장에 실패했습니다.',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: '저장 실패',
        description: '배치 저장 중 오류가 발생했습니다.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 2, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month, 1))
  }

  const handleToday = () => {
    setCurrentMonth(new Date())
  }

  return (
    <div className="p-3 sm:p-6">
      {/* 헤더 */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">수동 스케줄 배치</h1>
            <p className="text-sm sm:text-base text-gray-600">
              자동배치를 사용하지 않는 부서의 월간 스케줄을 수동으로 배치합니다
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/schedule')} className="w-full sm:w-auto">
            <ChevronLeft className="w-4 h-4 mr-2" />
            돌아가기
          </Button>
        </div>
      </div>

      {/* 부서 선택 및 기능 버튼 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            배치 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">부서 선택</label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="부서를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {departments.length === 0 && !loading && (
                <p className="text-sm text-amber-600 mt-2">
                  수동 배치 가능한 부서가 없습니다 (모든 부서가 자동배치 사용 중)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">배치 월</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center font-semibold">
                  {year}년 {month}월
                </div>
                <Button variant="outline" size="sm" onClick={handleNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday}>
                  오늘
                </Button>
              </div>
            </div>
          </div>

          {selectedDepartment && departmentStaff.length > 0 && (
            <>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  {selectedDepartment} 직원 ({departmentStaff.length}명)
                </p>
                <div className="flex flex-wrap gap-2">
                  {departmentStaff.map(staff => (
                    <Badge key={staff.id} variant="outline" className="bg-white">
                      {staff.rank ? `${staff.name} (${staff.rank})` : staff.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 엑셀 및 URL 생성 버튼 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                <Button variant="outline" onClick={handleDownloadTemplate} size="sm" className="text-xs sm:text-sm">
                  <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">엑셀 템플릿 다운로드</span>
                  <span className="sm:hidden">템플릿</span>
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} size="sm" className="text-xs sm:text-sm">
                  <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">엑셀 파일 업로드</span>
                  <span className="sm:hidden">업로드</span>
                </Button>
                <Button variant="outline" onClick={handleGenerateUrl} disabled={generatingUrl} size="sm" className="text-xs sm:text-sm">
                  <LinkIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  {generatingUrl ? 'URL 생성 중...' : (
                    <>
                      <span className="hidden sm:inline">부서장 URL 생성</span>
                      <span className="sm:hidden">URL 생성</span>
                    </>
                  )}
                </Button>
              </div>

              {deploymentUrl && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-700 mb-1 font-medium">부서장 전용 URL (클립보드에 복사됨)</p>
                  <p className="text-sm font-mono text-green-800 break-all">{deploymentUrl}</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* 달력 */}
      {selectedDepartment && departmentStaff.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {year}년 {month}월 배치 현황
                {deployedStartDate && deployedEndDate && (
                  <span className="text-sm font-normal text-gray-600">
                    ({formatDate(deployedStartDate)} ~ {formatDate(deployedEndDate)})
                  </span>
                )}
              </span>
              <Button onClick={handleSave} disabled={saving || !deployedStartDate || !deployedEndDate}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? '저장 중...' : '배치 저장'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!deployedStartDate || !deployedEndDate ? (
              <div className="p-8 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-600" />
                <h3 className="text-lg font-semibold text-amber-900 mb-2">
                  배포된 스케줄이 없습니다
                </h3>
                <p className="text-sm text-amber-700 mb-4">
                  수동 배치를 하려면 먼저 월간 스케줄 마법사에서 의사 배치를 완료하고 배포해야 합니다.
                </p>
                <Button variant="outline" onClick={() => router.push('/schedule/monthly-wizard')}>
                  월간 스케줄 마법사로 이동
                </Button>
              </div>
            ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <div className="min-w-[640px]">
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                  {WEEKDAYS.map((day, index) => (
                    <div
                      key={day}
                      className={cn(
                        'py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold',
                        index === 0 ? 'text-red-600' : 'text-gray-700'
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* 날짜 그리드 */}
                <div className="grid grid-cols-7">
                {dates.map((date, index) => {
                  const dateKey = getDateKey(date)
                  const schedule = scheduleData[dateKey]
                  const inDeployedRange = isInDeployedRange(date)
                  const today = isToday(date)
                  const weekend = isWeekend(date)
                  const sunday = isSunday(date)
                  const businessDay = isBusinessDay(date)
                  const assignedStaffIds = assignments.get(dateKey) || []
                  const isEditable = inDeployedRange && businessDay

                  return (
                    <div
                      key={index}
                      className={cn(
                        'min-h-[140px] sm:min-h-[180px] p-1 sm:p-2 border border-gray-200 flex flex-col',
                        !inDeployedRange && 'bg-gray-50/50',
                        today && 'bg-blue-50 border-blue-300',
                        weekend && inDeployedRange && businessDay && 'bg-red-50/30',
                        !businessDay && inDeployedRange && 'bg-gray-100/80'
                      )}
                    >
                      {/* 날짜 */}
                      <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <span
                          className={cn(
                            'text-xs sm:text-sm font-medium',
                            today && 'text-blue-600 font-bold',
                            !businessDay && inDeployedRange && 'text-gray-500',
                            !inDeployedRange && 'text-gray-400',
                            schedule?.holidayName && inDeployedRange && 'text-red-600 font-bold',
                            sunday && inDeployedRange && !today && !schedule?.holidayName && 'text-red-600'
                          )}
                        >
                          {date.getDate()}
                        </span>
                        {isEditable && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {assignedStaffIds.length}/{departmentStaff.length}
                          </Badge>
                        )}
                      </div>

                      {/* 원장 스케줄 표시 */}
                      {schedule && inDeployedRange && (
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
                      {inDeployedRange && !businessDay ? (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-xs text-gray-500 font-medium">
                            {schedule?.holidayName ? '공휴일' : '휴무일'}
                          </p>
                        </div>
                      ) : isEditable ? (
                        /* 직원 선택 체크박스 - 영업일 & 배포 범위 내만 */
                        <div className="flex-1 flex flex-col min-h-0">
                          <label className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-600 cursor-pointer hover:text-gray-900 mb-1 flex-shrink-0">
                            <Checkbox
                              checked={assignedStaffIds.length === departmentStaff.length && departmentStaff.length > 0}
                              onCheckedChange={() => toggleAllStaffForDay(date)}
                              className="w-3 h-3 sm:w-4 sm:h-4"
                            />
                            <span className="font-medium">전체</span>
                          </label>

                          <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                            {departmentStaff.map(staff => {
                              const annualLeaveStaffIds = annualLeaves.get(dateKey) || []
                              const isAssigned = assignedStaffIds.includes(staff.id)
                              const isAnnualLeave = annualLeaveStaffIds.includes(staff.id)

                              return (
                                <div
                                  key={staff.id}
                                  className="flex items-center gap-0.5 sm:gap-1.5 text-[10px] sm:text-xs hover:bg-gray-50 p-0.5 rounded"
                                >
                                  <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer" title="근무">
                                    <Checkbox
                                      checked={isAssigned}
                                      onCheckedChange={() => toggleStaffForDay(date, staff.id)}
                                      disabled={isAnnualLeave}
                                      className="w-3 h-3 sm:w-4 sm:h-4"
                                    />
                                    <span className="text-[9px] sm:text-[10px] text-gray-500">O</span>
                                  </label>
                                  <label className="flex items-center gap-0.5 sm:gap-1 cursor-pointer" title="연차">
                                    <Checkbox
                                      checked={isAnnualLeave}
                                      onCheckedChange={() => toggleAnnualLeaveForDay(date, staff.id)}
                                      disabled={isAssigned}
                                      className="w-3 h-3 sm:w-4 sm:h-4"
                                    />
                                    <span className="text-[9px] sm:text-[10px] text-blue-600">A</span>
                                  </label>
                                  <span className="flex-1 truncate text-[10px] sm:text-xs">{staff.name}</span>
                                  {staff.rank && <span className="text-[9px] sm:text-[10px] text-gray-500">{staff.rank}</span>}
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
              </div>
            </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12">
            <div className="text-center text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">부서를 선택해주세요</p>
              <p className="text-sm">
                수동 배치를 시작하려면 위에서 부서와 월을 선택하세요
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
