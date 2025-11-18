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
import { AlertTriangle, TrendingUp, Search, RefreshCw } from 'lucide-react'

interface AnomalyRecord {
  id: string
  type: string
  staffId: string
  staffName: string
  date: string
  checkTime: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  score: number
  description: string
  expectedRange?: string
  actualValue?: string
  context?: any
}

interface ApiResponse {
  period: {
    startDate: string
    endDate: string
  }
  anomalies: AnomalyRecord[]
  summary: {
    total: number
    byType: Record<string, number>
    bySeverity: {
      HIGH: number
      MEDIUM: number
      LOW: number
    }
  }
}

export default function AnomaliesPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

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
      const response = await fetch(`/api/analytics/anomalies/detect?${params}`)
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

  // Filter anomalies
  const filteredAnomalies = data?.anomalies.filter(anomaly => {
    if (severityFilter !== 'all' && anomaly.severity !== severityFilter) return false
    if (typeFilter !== 'all' && anomaly.type !== typeFilter) return false
    if (search && !anomaly.staffName.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }) || []

  // Get unique types
  const anomalyTypes = data ? Object.keys(data.summary.byType) : []

  // Type labels
  const typeLabels: Record<string, string> = {
    OUTLIER_CHECK_IN_EARLY: '이른 출근',
    OUTLIER_CHECK_IN_LATE: '늦은 출근',
    OUTLIER_CHECK_OUT_EARLY: '이른 퇴근',
    OUTLIER_CHECK_OUT_LATE: '늦은 퇴근',
    PATTERN_CONSECUTIVE_LATE: '연속 지각',
    PATTERN_CONSECUTIVE_EARLY: '연속 조퇴',
    PATTERN_MISSING_CHECKOUT: '퇴근 미체크',
    PATTERN_IP_ANOMALY: 'IP 이상',
    PATTERN_WEEKEND_SPIKE: '주말 활동',
  }

  // Severity badge colors
  const getSeverityBadge = (severity: 'HIGH' | 'MEDIUM' | 'LOW') => {
    const variants = {
      HIGH: 'destructive' as const,
      MEDIUM: 'default' as const,
      LOW: 'secondary' as const,
    }
    const labels = {
      HIGH: '높음',
      MEDIUM: '중간',
      LOW: '낮음',
    }
    return (
      <Badge variant={variants[severity]}>
        {labels[severity]}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">이상 징후 탐지</h1>
          <p className="text-muted-foreground mt-2">
            통계 알고리즘을 사용한 비정상 출퇴근 패턴 자동 감지
          </p>
        </div>

        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          재분석
        </Button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 이상 징후</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.total}건</div>
              <p className="text-xs text-muted-foreground mt-1">
                감지된 이상 패턴
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">높음</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{data.summary.bySeverity.HIGH}건</div>
              <p className="text-xs text-muted-foreground mt-1">
                즉시 확인 필요
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">중간</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{data.summary.bySeverity.MEDIUM}건</div>
              <p className="text-xs text-muted-foreground mt-1">
                주의 관찰
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">낮음</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{data.summary.bySeverity.LOW}건</div>
              <p className="text-xs text-muted-foreground mt-1">
                참고용
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
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

            <div>
              <Label>심각도</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="HIGH">높음</SelectItem>
                  <SelectItem value="MEDIUM">중간</SelectItem>
                  <SelectItem value="LOW">낮음</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>유형</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {anomalyTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {typeLabels[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>직원 검색</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이름 입력..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Anomalies Table */}
      <Card>
        <CardHeader>
          <CardTitle>이상 징후 목록 ({filteredAnomalies.length}건)</CardTitle>
          <CardDescription>
            자동 감지된 비정상 패턴 및 통계적 이상값
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              분석 중...
            </div>
          ) : filteredAnomalies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {data?.summary.total === 0 ? '이상 징후가 없습니다.' : '필터 조건에 맞는 결과가 없습니다.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead>직원</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>심각도</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead>예상 범위</TableHead>
                  <TableHead className="text-center">실제값</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnomalies.map((anomaly) => (
                  <TableRow key={anomaly.id}>
                    <TableCell>{anomaly.date}</TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/analytics/individual/${anomaly.staffId}`}
                        className="hover:underline"
                      >
                        {anomaly.staffName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {typeLabels[anomaly.type] || anomaly.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{getSeverityBadge(anomaly.severity)}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm">{anomaly.description}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {anomaly.expectedRange || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-semibold">
                        {anomaly.actualValue || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/analytics/individual/${anomaly.staffId}`}>
                        <Button variant="ghost" size="sm">
                          상세
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

      {/* Detection Methods Info */}
      <Card>
        <CardHeader>
          <CardTitle>감지 알고리즘</CardTitle>
          <CardDescription>
            이상 징후 자동 탐지에 사용되는 통계 방법
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Z-Score 분석</h4>
              <p className="text-sm text-muted-foreground">
                평균으로부터 표준편차 2.5배 이상 벗어난 출퇴근 시간을 이상값으로 감지합니다.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">IQR 방법</h4>
              <p className="text-sm text-muted-foreground">
                사분위수 범위를 사용하여 극단적인 이상값에 강건한 이상 탐지를 수행합니다.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm">패턴 매칭</h4>
              <p className="text-sm text-muted-foreground">
                연속 지각, 퇴근 미체크, IP 이상 등 규칙 기반 패턴 감지를 수행합니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
