'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, Search, TrendingUp, TrendingDown } from 'lucide-react'
import { StaffApplicationsDialog } from './StaffApplicationsDialog'

type StaffMember = {
  id: string
  name: string
  rank: string
  email: string | null
  phoneNumber: string | null
  statistics: {
    total: number
    pending: number
    confirmed: number
    cancelled: number
    annual: number
    off: number
  }
  recentApplications: Array<{
    id: string
    date: string
    leaveType: 'ANNUAL' | 'OFF'
    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
    year: number
    month: number
  }>
}

const STATUS_LABELS = {
  PENDING: '대기중',
  CONFIRMED: '승인',
  CANCELLED: '취소',
}

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

const LEAVE_TYPE_LABELS = {
  ANNUAL: '연차',
  OFF: '오프',
}

const RANK_LABELS: Record<string, string> = {
  HYGIENIST: '위생사',
  ASSISTANT: '어시스턴트',
  COORDINATOR: '코디',
  NURSE: '간호',
  OTHER: '기타',
}

type FilterOption = {
  name: string
  count: number
}

export function StaffView() {
  const { toast } = useToast()
  const [staffData, setStaffData] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [rankFilter, setRankFilter] = useState<string>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString())
  const [searchTerm, setSearchTerm] = useState('')

  // 동적 필터 옵션
  const [departments, setDepartments] = useState<FilterOption[]>([])
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  // 직원별 신청 내역 다이얼로그
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [selectedStaffName, setSelectedStaffName] = useState<string | null>(null)

  const fetchFilterOptions = async () => {
    try {
      setLoadingOptions(true)
      const response = await fetch('/api/leave-management/filter-options')
      const result = await response.json()

      if (result.success) {
        setDepartments(result.data.departments)
        setCategories(result.data.categories)
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error)
    } finally {
      setLoadingOptions(false)
    }
  }

  const fetchStaffData = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      if (rankFilter !== 'all') {
        params.append('rank', rankFilter)
      }
      if (departmentFilter !== 'all') {
        params.append('department', departmentFilter)
      }
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter)
      }
      if (yearFilter) {
        params.append('year', yearFilter)
      }

      const response = await fetch(`/api/leave-management/staff-view?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setStaffData(result.data)
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: result.error || '직원 데이터를 불러오는데 실패했습니다.',
        })
      }
    } catch (error) {
      console.error('Failed to fetch staff data:', error)
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFilterOptions()
  }, [])

  useEffect(() => {
    fetchStaffData()
  }, [rankFilter, departmentFilter, categoryFilter, yearFilter])

  // 검색어 필터링
  const filteredStaff = staffData.filter((member) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      member.name.toLowerCase().includes(searchLower) ||
      member.email?.toLowerCase().includes(searchLower) ||
      RANK_LABELS[member.rank]?.toLowerCase().includes(searchLower)
    )
  })

  // 전체 통계
  const totalStats = staffData.reduce(
    (acc, member) => {
      acc.confirmed += member.statistics.confirmed
      acc.pending += member.statistics.pending
      acc.annual += member.statistics.annual
      acc.off += member.statistics.off
      return acc
    },
    { confirmed: 0, pending: 0, annual: 0, off: 0 }
  )

  return (
    <div className="space-y-4">
      {/* 필터 및 검색 */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="이름, 이메일, 직급으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 부서</SelectItem>
                {departments.filter(dept => dept.name && dept.name.trim() !== '').map((dept) => (
                  <SelectItem key={dept.name} value={dept.name}>
                    {dept.name} ({dept.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 구분</SelectItem>
                {categories.filter(cat => cat.name && cat.name.trim() !== '').map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {cat.name} ({cat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={rankFilter} onValueChange={setRankFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 직급</SelectItem>
                <SelectItem value="HYGIENIST">위생사</SelectItem>
                <SelectItem value="ASSISTANT">어시스턴트</SelectItem>
                <SelectItem value="COORDINATOR">코디</SelectItem>
                <SelectItem value="NURSE">간호</SelectItem>
                <SelectItem value="OTHER">기타</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-[100px]"
              placeholder="연도"
            />

            <Button
              variant="outline"
              size="icon"
              onClick={fetchStaffData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* 전체 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{totalStats.confirmed}</div>
            <div className="text-sm text-gray-600">총 승인 건수</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{totalStats.pending}</div>
            <div className="text-sm text-gray-600">대기 중</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{totalStats.annual}</div>
            <div className="text-sm text-gray-600">연차 사용</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{totalStats.off}</div>
            <div className="text-sm text-gray-600">오프 사용</div>
          </div>
        </div>
      </Card>

      {/* 직원 카드 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <Card className="p-12 text-center col-span-full">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p className="text-gray-600">로딩 중...</p>
          </Card>
        ) : filteredStaff.length === 0 ? (
          <Card className="p-12 text-center col-span-full">
            <p className="text-gray-600">직원 데이터가 없습니다.</p>
          </Card>
        ) : (
          filteredStaff.map((member) => (
            <Card
              key={member.id}
              className="p-3 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedStaffId(member.id)
                setSelectedStaffName(member.name)
                setDialogOpen(true)
              }}
            >
              {/* 직원 정보 */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-base">{member.name}</h3>
                  <p className="text-xs text-gray-600">{RANK_LABELS[member.rank]}</p>
                </div>
              </div>

              {/* 통계 */}
              <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-base font-semibold text-blue-600">
                    {member.statistics.total}
                    {member.statistics.annual > 0 && (
                      <span className="text-xs text-gray-500 ml-1">({member.statistics.annual})</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-600">총 신청(연차)</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-semibold text-green-600">
                    {member.statistics.confirmed}
                  </div>
                  <div className="text-[10px] text-gray-600">승인</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-semibold text-yellow-600">
                    {member.statistics.pending}
                  </div>
                  <div className="text-[10px] text-gray-600">대기</div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* 형평성 분석 */}
      {!loading && filteredStaff.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">형평성 분석</h3>
          <div className="space-y-2">
            {filteredStaff
              .sort((a, b) => b.statistics.confirmed - a.statistics.confirmed)
              .slice(0, 5)
              .map((member, index) => {
                const avgConfirmed = totalStats.confirmed / filteredStaff.length
                const difference = member.statistics.confirmed - avgConfirmed

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium w-6">{index + 1}</span>
                      <div>
                        <div className="text-sm font-medium">{member.name}</div>
                        <div className="text-xs text-gray-600">
                          {RANK_LABELS[member.rank]}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {member.statistics.confirmed}건
                      </span>
                      {difference > 0 ? (
                        <div className="flex items-center text-xs text-red-600">
                          <TrendingUp className="w-3 h-3" />
                          +{difference.toFixed(1)}
                        </div>
                      ) : difference < 0 ? (
                        <div className="flex items-center text-xs text-blue-600">
                          <TrendingDown className="w-3 h-3" />
                          {difference.toFixed(1)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            평균 승인 건수: {(totalStats.confirmed / filteredStaff.length).toFixed(1)}건
          </p>
        </Card>
      )}

      {/* 직원별 신청 내역 다이얼로그 */}
      <StaffApplicationsDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setSelectedStaffId(null)
          setSelectedStaffName(null)
          fetchStaffData() // 다이얼로그 닫을 때 데이터 새로고침
        }}
        staffId={selectedStaffId}
        staffName={selectedStaffName}
      />
    </div>
  )
}
