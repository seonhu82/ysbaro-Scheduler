'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, ArrowUpDown, Calendar, Download, TrendingUp, TrendingDown } from 'lucide-react'

interface StaffStats {
  totalDays: number
  checkedInDays: number
  attendanceRate: number
  avgCheckInTime: string | null
  avgCheckOutTime: string | null
  lateCount: number
  earlyLeaveCount: number
  onTimeRate: number
  totalCheckIns: number
  totalCheckOuts: number
}

interface Staff {
  id: string
  name: string
  departmentName: string | null
  categoryName: string | null
  rank: string | null
  workType: string
  stats: StaffStats
}

interface AnalyticsData {
  period: {
    startDate: string
    endDate: string
    totalDays: number
  }
  summary: {
    totalStaff: number
    avgAttendanceRate: number
    avgOnTimeRate: number
    totalLates: number
    totalEarlyLeaves: number
  }
  staff: Staff[]
}

export default function IndividualAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

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
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(departmentFilter !== 'all' && { departmentName: departmentFilter }),
        ...(search && { search }),
        sortBy,
        sortOrder,
      })

      const response = await fetch(`/api/analytics/individual?${params}`)
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
  }, [startDate, endDate, departmentFilter, sortBy, sortOrder])

  // Get unique departments
  const departments = data
    ? Array.from(new Set(data.staff.map(s => s.departmentName).filter(Boolean)))
    : []

  const handleSearchSubmit = () => {
    fetchData()
  }

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  // Helper to get badge color
  const getAttendanceBadgeColor = (rate: number) => {
    if (rate >= 95) return 'bg-green-500'
    if (rate >= 85) return 'bg-blue-500'
    if (rate >= 70) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getOnTimeBadgeColor = (rate: number) => {
    if (rate >= 95) return 'bg-green-500'
    if (rate >= 85) return 'bg-blue-500'
    if (rate >= 70) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">개인별 출퇴근 분석</h1>
          <p className="text-muted-foreground mt-2">
            직원별 출퇴근 패턴 및 통계 분석
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 직원</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.totalStaff}명</div>
              <p className="text-xs text-muted-foreground mt-1">
                분석 대상 직원 수
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">평균 출근율</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.avgAttendanceRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                전체 직원 평균
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">평균 정시 출근율</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.avgOnTimeRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                지각 없이 출근한 비율
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 지각/조퇴</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.summary.totalLates + data.summary.totalEarlyLeaves}건
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                지각 {data.summary.totalLates} / 조퇴 {data.summary.totalEarlyLeaves}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>검색 및 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-1">
              <Label>기간 시작</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="lg:col-span-1">
              <Label>기간 종료</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="lg:col-span-2">
              <Label>직원명 검색</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="직원 이름 입력..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
                />
                <Button onClick={handleSearchSubmit} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="lg:col-span-1">
              <Label>부서</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept!}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-1">
              <Label>정렬</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">이름</SelectItem>
                  <SelectItem value="attendanceRate">출근율</SelectItem>
                  <SelectItem value="onTimeRate">정시 출근율</SelectItem>
                  <SelectItem value="lateCount">지각 횟수</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff List Table */}
      <Card>
        <CardHeader>
          <CardTitle>직원 목록 ({data?.staff.length || 0}명)</CardTitle>
          <CardDescription>
            클릭하여 개인별 상세 분석 보기
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              데이터를 불러오는 중...
            </div>
          ) : !data || data.staff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              데이터가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">이름</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>직급</TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('attendanceRate')}>
                      출근율
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('onTimeRate')}>
                      정시 출근율
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">평균 출근</TableHead>
                  <TableHead className="text-center">평균 퇴근</TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('lateCount')}>
                      지각
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">조퇴</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.staff.map((staff) => (
                  <TableRow key={staff.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{staff.name}</TableCell>
                    <TableCell>{staff.departmentName || '-'}</TableCell>
                    <TableCell>{staff.rank || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={getAttendanceBadgeColor(staff.stats.attendanceRate)}>
                        {staff.stats.attendanceRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={getOnTimeBadgeColor(staff.stats.onTimeRate)}>
                        {staff.stats.onTimeRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {staff.stats.avgCheckInTime || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {staff.stats.avgCheckOutTime || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {staff.stats.lateCount > 0 ? (
                        <span className="text-red-600 font-semibold">
                          {staff.stats.lateCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {staff.stats.earlyLeaveCount > 0 ? (
                        <span className="text-orange-600 font-semibold">
                          {staff.stats.earlyLeaveCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/analytics/individual/${staff.id}`}>
                        <Button variant="outline" size="sm">
                          상세보기
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
