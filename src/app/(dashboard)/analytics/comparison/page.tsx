'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { TrendingUp, TrendingDown, Award, Users } from 'lucide-react'

interface DepartmentKPI {
  departmentName: string
  staffCount: number
  attendanceRate: number
  onTimeRate: number
  avgCheckInTime: string
  avgCheckOutTime: string
  avgWorkHours: number
  totalCheckIns: number
  totalCheckOuts: number
  lateCount: number
  earlyLeaveCount: number
  checkedInDays: number
  expectedDays: number
  nightShiftCount: number
  weekendWorkCount: number
}

interface ApiResponse {
  period: {
    startDate: string
    endDate: string
    totalDays: number
  }
  departments: DepartmentKPI[]
  overall: {
    totalStaff: number
    avgAttendanceRate: number
    avgOnTimeRate: number
  }
}

export default function DepartmentComparisonPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Date range
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Fetch data
  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const response = await fetch(`/api/analytics/comparison/departments?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        console.error('Failed to fetch data:', result.error)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  // Prepare chart data
  const barChartData = data?.departments.map(dept => ({
    name: dept.departmentName,
    출근율: dept.attendanceRate,
    정시출근율: dept.onTimeRate,
    평균근무시간: dept.avgWorkHours,
  })) || []

  // Prepare radar chart data (top 5 departments)
  const radarChartData = data?.departments.slice(0, 5).map(dept => ({
    department: dept.departmentName,
    출근율: dept.attendanceRate,
    정시출근율: dept.onTimeRate,
    근무시간: Math.min(dept.avgWorkHours * 10, 100), // Scale to 100
  })) || []

  // Get rankings
  const topAttendance = data?.departments[0]
  const topOnTime = data?.departments.reduce((prev, current) =>
    current.onTimeRate > prev.onTimeRate ? current : prev
  , data.departments[0])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">부서별 비교 분석</h1>
        <p className="text-muted-foreground mt-2">
          부서간 출퇴근 KPI 비교 및 벤치마킹
        </p>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 부서</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.departments.length}개</div>
              <p className="text-xs text-muted-foreground mt-1">
                분석 대상 부서
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">평균 출근율</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overall.avgAttendanceRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                전체 부서 평균
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">평균 정시 출근율</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overall.avgOnTimeRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                전체 부서 평균
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">최우수 부서</CardTitle>
              <Award className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{topAttendance?.departmentName}</div>
              <p className="text-xs text-muted-foreground mt-1">
                출근율 {topAttendance?.attendanceRate}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Date Range */}
      <Card>
        <CardHeader>
          <CardTitle>기간 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>기간 시작</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label>기간 종료</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>부서별 KPI 비교</CardTitle>
            <CardDescription>
              출근율, 정시 출근율, 평균 근무시간 비교
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="text-center py-8 text-muted-foreground">
                데이터를 불러오는 중...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="출근율" fill="#8884d8" />
                  <Bar dataKey="정시출근율" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>상위 부서 종합 평가</CardTitle>
            <CardDescription>
              출근율, 정시 출근율, 근무시간 종합 (상위 5개)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !data || radarChartData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                데이터를 불러오는 중...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarChartData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="department" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar name="종합 점수" dataKey="출근율" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle>부서별 상세 순위</CardTitle>
          <CardDescription>
            출근율 기준 정렬 (높은 순)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <div className="text-center py-8 text-muted-foreground">
              데이터를 불러오는 중...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">순위</TableHead>
                  <TableHead>부서명</TableHead>
                  <TableHead className="text-right">직원 수</TableHead>
                  <TableHead className="text-right">출근율</TableHead>
                  <TableHead className="text-right">정시 출근율</TableHead>
                  <TableHead className="text-center">평균 출근</TableHead>
                  <TableHead className="text-center">평균 퇴근</TableHead>
                  <TableHead className="text-right">평균 근무시간</TableHead>
                  <TableHead className="text-center">야간 근무</TableHead>
                  <TableHead className="text-center">주말 근무</TableHead>
                  <TableHead className="text-center">지각</TableHead>
                  <TableHead className="text-center">조퇴</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.departments.map((dept, index) => {
                  const isAboveAverage = dept.attendanceRate >= data.overall.avgAttendanceRate
                  const isTopPerformer = index === 0

                  return (
                    <TableRow key={dept.departmentName} className={isTopPerformer ? 'bg-yellow-50' : ''}>
                      <TableCell className="font-semibold">
                        {index === 0 && <Award className="h-4 w-4 text-yellow-500 inline mr-1" />}
                        #{index + 1}
                      </TableCell>
                      <TableCell className="font-medium">{dept.departmentName}</TableCell>
                      <TableCell className="text-right">{dept.staffCount}명</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold">{dept.attendanceRate}%</span>
                          {isAboveAverage ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={dept.onTimeRate >= 90 ? 'default' : 'secondary'}
                        >
                          {dept.onTimeRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{dept.avgCheckInTime}</TableCell>
                      <TableCell className="text-center">{dept.avgCheckOutTime}</TableCell>
                      <TableCell className="text-right">{dept.avgWorkHours}시간</TableCell>
                      <TableCell className="text-center">
                        {dept.nightShiftCount > 0 ? (
                          <span className="text-blue-600 font-semibold">{dept.nightShiftCount}회</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {dept.weekendWorkCount > 0 ? (
                          <span className="text-purple-600 font-semibold">{dept.weekendWorkCount}회</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {dept.lateCount > 0 ? (
                          <span className="text-red-600 font-semibold">{dept.lateCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {dept.earlyLeaveCount > 0 ? (
                          <span className="text-orange-600 font-semibold">{dept.earlyLeaveCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {data && topAttendance && topOnTime && (
        <Card>
          <CardHeader>
            <CardTitle>인사이트</CardTitle>
            <CardDescription>
              부서별 비교 분석 결과
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Award className="h-4 w-4 text-yellow-500" />
                    우수 부서
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 출근율 1위: {topAttendance.departmentName} ({topAttendance.attendanceRate}%)</li>
                    <li>• 정시 출근율 1위: {topOnTime.departmentName} ({topOnTime.onTimeRate}%)</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">개선 필요 부서</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {data.departments.filter(d => d.attendanceRate < 80).map(dept => (
                      <li key={dept.departmentName}>
                        • {dept.departmentName}: 출근율 {dept.attendanceRate}%
                      </li>
                    ))}
                    {data.departments.filter(d => d.attendanceRate < 80).length === 0 && (
                      <li>• 모든 부서가 양호한 출근율을 유지하고 있습니다.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
