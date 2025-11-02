/**
 * 메인 대시보드 페이지 - 월간 캘린더 뷰
 * 경로: /
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Calendar, Clock, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import MonthlyCalendarView from '@/components/dashboard/MonthlyCalendarView'

interface DashboardStats {
  staff: {
    total: number
    active: number
  }
  attendance: {
    todayCheckIns: number
    todayCheckOuts: number
    suspicious: number
  }
  leaves: {
    pending: number
    confirmed: number
    thisMonth: number
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const [staffRes, attendanceRes, leavesRes] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/attendance/statistics?limit=1'),
        fetch('/api/leave-management/list-view')
      ])

      const [staffData, attendanceData, leavesData] = await Promise.all([
        staffRes.json(),
        attendanceRes.json(),
        leavesRes.json()
      ])

      const dashboardStats: DashboardStats = {
        staff: {
          total: staffData.success ? staffData.data.length : 0,
          active: staffData.success ? staffData.data.filter((s: any) => s.isActive).length : 0
        },
        attendance: {
          todayCheckIns: attendanceData.success ? attendanceData.data.summary?.totalCheckIns || 0 : 0,
          todayCheckOuts: attendanceData.success ? attendanceData.data.summary?.totalCheckOuts || 0 : 0,
          suspicious: attendanceData.success ? attendanceData.data.summary?.suspiciousCount || 0 : 0
        },
        leaves: {
          pending: leavesData.success ? leavesData.data.filter((l: any) => l.status === 'PENDING').length : 0,
          confirmed: leavesData.success ? leavesData.data.filter((l: any) => l.status === 'CONFIRMED').length : 0,
          thisMonth: leavesData.success ? leavesData.data.length : 0
        }
      }

      setStats(dashboardStats)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
      toast({
        variant: 'destructive',
        title: '데이터 로드 실패',
        description: '대시보드 통계를 불러올 수 없습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">대시보드 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">대시보드</h1>
        <p className="text-gray-600">연세바로치과 스케줄 관리 시스템</p>
      </div>

      {/* 주요 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/staff')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              직원 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.staff.active}</div>
            <p className="text-xs text-gray-500 mt-1">전체 {stats.staff.total}명 중 활성</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/attendance/history')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              오늘 출퇴근
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.attendance.todayCheckIns}</div>
            <p className="text-xs text-gray-500 mt-1">출근 / 퇴근 {stats.attendance.todayCheckOuts}명</p>
            {stats.attendance.suspicious > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                의심 {stats.attendance.suspicious}건
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/leave-management')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              연차 신청
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats.leaves.pending}</div>
            <p className="text-xs text-gray-500 mt-1">대기중 / 이번달 {stats.leaves.thisMonth}건</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/leave-management/list-view')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              승인 완료
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.leaves.confirmed}</div>
            <p className="text-xs text-gray-500 mt-1">이번 달 승인 건수</p>
          </CardContent>
        </Card>
      </div>

      {/* 월간 캘린더 */}
      <MonthlyCalendarView />
    </div>
  )
}
