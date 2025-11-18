'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Users, TrendingUp, AlertCircle, Play, Edit } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

interface WeekSummary {
  weekNumber: number
  startDate: string
  endDate: string
  totalSlots: number
  assignedSlots: number
  issues: number
  issuesDetail?: string
  status: string
  label: string
}

interface DepartmentStats {
  name: string
  total: number
  withCategory: number
}

interface DepartmentApiStats {
  department: string
  staffCount: number
  dayShifts: number
  nightShifts: number
  offDays: number
  useAutoAssignment: boolean
  avgDaysPerStaff: string
}

export default function ScheduleManagementPage() {
  const { toast } = useToast()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [weekSummaries, setWeekSummaries] = useState<WeekSummary[]>([])
  const [totalStaff, setTotalStaff] = useState(0)
  const [treatmentStaff, setTreatmentStaff] = useState(0)
  const [loading, setLoading] = useState(true)
  const [warningsSummary, setWarningsSummary] = useState('')
  const [totalWarnings, setTotalWarnings] = useState(0)
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([])
  const [autoAssignDeptStats, setAutoAssignDeptStats] = useState<DepartmentApiStats[]>([])
  const [manualAssignDeptStats, setManualAssignDeptStats] = useState<DepartmentApiStats[]>([])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // 주차 요약 조회
        console.log(`🔍 Fetching summary for ${year}년 ${month}월`)
        const summaryResponse = await fetch(`/api/schedule/summary?year=${year}&month=${month}`)
        const summaryResult = await summaryResponse.json()

        console.log('📦 Summary Response:', summaryResult)

        if (!summaryResult.success) {
          console.error('❌ API Error:', summaryResult.error)
          setWeekSummaries([])
          setTotalWarnings(0)
          setWarningsSummary('')
        } else {
          // successResponse가 data를 감싸므로 data.data로 접근
          const weekData = summaryResult.data?.data
          if (Array.isArray(weekData)) {
            console.log('✅ Setting week summaries:', weekData)
            setWeekSummaries(weekData)
          } else {
            console.log('❌ No valid week data, setting empty array')
            setWeekSummaries([])
          }

          // 경고 정보 설정
          const warnings = summaryResult.data?.warnings
          if (warnings) {
            setTotalWarnings(warnings.total || 0)
            setWarningsSummary(warnings.summary || '')
            console.log('⚠️ Warnings:', warnings)
          } else {
            setTotalWarnings(0)
            setWarningsSummary('')
          }

          // 부서별 통계 (자동/수동 구분)
          const byDepartment = summaryResult.data?.byDepartment
          if (Array.isArray(byDepartment)) {
            const autoDepts = byDepartment.filter(d => d.useAutoAssignment)
            const manualDepts = byDepartment.filter(d => !d.useAutoAssignment)
            setAutoAssignDeptStats(autoDepts)
            setManualAssignDeptStats(manualDepts)
            console.log('📊 Auto Assign Depts:', autoDepts)
            console.log('📊 Manual Assign Depts:', manualDepts)
          }
        }

        // 전체 직원 수 및 부서 정보 조회
        const [staffResponse, departmentsResponse] = await Promise.all([
          fetch('/api/staff'),
          fetch('/api/settings/departments')
        ])

        const staffResult = await staffResponse.json()
        const departmentsData = await departmentsResponse.json()

        if (staffResult.success && Array.isArray(staffResult.data)) {
          const allStaff = staffResult.data
          setTotalStaff(allStaff.length)

          // 부서 데이터 처리 (배열 직접 반환 또는 {success, data} 형식)
          let departments: any[] = []
          if (Array.isArray(departmentsData)) {
            departments = departmentsData
          } else if (departmentsData?.success && departmentsData?.data) {
            departments = departmentsData.data
          }

          // 자동배치 사용 부서만 필터링
          const autoAssignDepartments = departments.filter((dept: any) => dept.useAutoAssignment)

          // 부서별 통계 계산
          const deptStats: DepartmentStats[] = autoAssignDepartments.map((dept: any) => ({
            name: dept.name,
            total: allStaff.filter((staff: any) => staff.departmentName === dept.name).length,
            withCategory: allStaff.filter((staff: any) =>
              staff.departmentName === dept.name && staff.categoryName
            ).length
          }))

          setDepartmentStats(deptStats)

          // 전체 자동배치 부서의 배치 가능 인원 합계
          const totalAutoAssignStaff = deptStats.reduce((sum, dept) => sum + dept.withCategory, 0)
          setTreatmentStaff(totalAutoAssignStaff)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setWeekSummaries([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentMonth, year, month])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">스케줄 관리</h1>
        <p className="text-gray-600">
          원장 및 직원 스케줄 배치를 관리합니다
        </p>
      </div>

      {/* 빠른 작업 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/schedule/auto-assign">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Play className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">원장 스케줄 배치</h3>
                  <p className="text-sm text-gray-500">주간 패턴 기반 배치</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/schedule/monthly-wizard">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">직원 스케줄 배치</h3>
                  <p className="text-sm text-gray-500">형평성 기반 자동 배정</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/calendar">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 p-3 rounded-lg">
                  <Calendar className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">캘린더</h3>
                  <p className="text-sm text-gray-500">월간 스케줄 보기</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/schedule/manual">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-teal-100 p-3 rounded-lg">
                  <Edit className="w-6 h-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">수동 배치</h3>
                  <p className="text-sm text-gray-500">부서별 수동 스케줄</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 현재 달 요약 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {year}년 {month}월 스케줄 요약
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(year, month - 2, 1))}
              >
                이전 달
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                오늘
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(year, month, 1))}
              >
                다음 달
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : !weekSummaries || weekSummaries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">{year}년 {month}월 스케줄이 없습니다</p>
              <p className="text-sm text-gray-400">스케줄을 생성하거나 다른 월을 선택해주세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {weekSummaries.map((week) => (
                <div
                  key={week.weekNumber}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline">
                          {week.label}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {week.startDate} ~ {week.endDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span>
                            배치: {week.assignedSlots}{week.totalSlots > 0 ? `/${week.totalSlots}` : '명'}
                          </span>
                        </div>
                        {week.issues > 0 && (
                          <div className="flex items-center gap-1 text-amber-600">
                            <AlertCircle className="w-4 h-4" />
                            <span>
                              경고 {week.issues}건
                              {week.issuesDetail && ` (${week.issuesDetail})`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {week.status === 'prev-month' ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                          이전달 완료
                        </Badge>
                      ) : week.status === 'completed' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          완료
                        </Badge>
                      ) : week.status === 'doctor-only' ? (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                          원장 스케줄 완료
                        </Badge>
                      ) : week.status === 'no-doctor' ? (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                          원장 스케줄 없음
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          진행중
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">전체 직원</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-blue-600">{treatmentStaff}</p>
                  <p className="text-lg text-gray-400">/</p>
                  <p className="text-lg text-gray-600">{totalStaff}명</p>
                </div>
                <p className="text-xs text-gray-500 mt-1">배치인원 / 총인원</p>
              </div>
              <Users className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">이번 달 주차</p>
                <p className="text-2xl font-bold">{weekSummaries?.length || 0}주</p>
              </div>
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">배치율</p>
                <p className="text-2xl font-bold">
                  {weekSummaries && weekSummaries.length > 0
                    ? (() => {
                        // Only include weeks with doctor schedule (totalSlots > 0)
                        const weeksWithSchedule = weekSummaries.filter(w => w.totalSlots > 0)
                        if (weeksWithSchedule.length === 0) return 0

                        const totalAssigned = weeksWithSchedule.reduce((sum, w) => sum + w.assignedSlots, 0)
                        const totalSlots = weeksWithSchedule.reduce((sum, w) => sum + w.totalSlots, 0)

                        return Math.round((totalAssigned / totalSlots) * 100)
                      })()
                    : 0}
                  %
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">경고 발생</p>
                <p className="text-2xl font-bold">
                  {totalWarnings}건
                </p>
                {warningsSummary && (
                  <p className="text-xs text-gray-500 mt-1">
                    {warningsSummary}
                  </p>
                )}
              </div>
              <AlertCircle
                className={`w-8 h-8 ${
                  totalWarnings > 0
                    ? 'text-amber-500'
                    : 'text-gray-400'
                }`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 자동 배치 부서별 현황 */}
      {autoAssignDeptStats.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              부서별 배치 현황 (자동 배치)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {autoAssignDeptStats.map((dept) => (
                <div
                  key={dept.department}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {dept.department}
                    </Badge>
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                      자동
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">배치된 직원</p>
                      <p className="text-xl font-bold text-blue-600">{dept.staffCount}명</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">주간</p>
                        <p className="font-medium text-green-600">{dept.dayShifts}일</p>
                      </div>
                      <div>
                        <p className="text-gray-500">야간</p>
                        <p className="font-medium text-indigo-600">{dept.nightShifts}일</p>
                      </div>
                      <div>
                        <p className="text-gray-500">오프</p>
                        <p className="font-medium text-gray-600">{dept.offDays}일</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-500">1인 평균 근무일</p>
                      <p className="text-lg font-bold text-gray-700">{dept.avgDaysPerStaff}일</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 수동 배치 부서별 현황 */}
      {manualAssignDeptStats.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              부서별 배치 현황 (수동 배치)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {manualAssignDeptStats.map((dept) => (
                <div
                  key={dept.department}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                      {dept.department}
                    </Badge>
                    <Badge className="bg-teal-100 text-teal-700 border-teal-200">
                      수동
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-500">배치된 직원</p>
                      <p className="text-xl font-bold text-teal-600">{dept.staffCount}명</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">주간</p>
                        <p className="font-medium text-green-600">{dept.dayShifts}일</p>
                      </div>
                      <div>
                        <p className="text-gray-500">야간</p>
                        <p className="font-medium text-indigo-600">{dept.nightShifts}일</p>
                      </div>
                      <div>
                        <p className="text-gray-500">오프</p>
                        <p className="font-medium text-gray-600">{dept.offDays}일</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-500">1인 평균 근무일</p>
                      <p className="text-lg font-bold text-gray-700">{dept.avgDaysPerStaff}일</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
