/**
 * 메인 대시보드 페이지
 * 경로: /
 *
 * 기능:
 * - 주요 통계 카드
 * - 최근 활동 요약
 * - 스케줄 현황
 * - 연차 현황
 * - 출퇴근 현황
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users,
  Calendar,
  Clock,
  Bell,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

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
  activities: {
    recent: any[]
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
      // 여러 API를 병렬로 호출
      const [staffRes, attendanceRes, leavesRes, activityRes] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/attendance/statistics?limit=1'),
        fetch('/api/leave-management/list-view'),
        fetch('/api/activity-log?limit=5')
      ])

      const [staffData, attendanceData, leavesData, activityData] = await Promise.all([
        staffRes.json(),
        attendanceRes.json(),
        leavesRes.json(),
        activityRes.json()
      ])

      // 통계 데이터 조합
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
        },
        activities: {
          recent: activityData.success ? activityData.data.logs : []
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
          <Activity className="w-12 h-12 mx-auto mb-3 animate-pulse text-blue-500" />
          <p className="text-gray-500">대시보드 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">대시보드</h1>
        <p className="text-gray-600">
          연세바로치과 스케줄 관리 시스템
        </p>
      </div>

      {/* 주요 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 직원 현황 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/staff')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              직원 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.staff.active}</div>
            <p className="text-xs text-gray-500 mt-1">
              전체 {stats.staff.total}명 중 활성
            </p>
          </CardContent>
        </Card>

        {/* 오늘 출퇴근 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/attendance/history')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              오늘 출퇴근
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.attendance.todayCheckIns}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              출근 / 퇴근 {stats.attendance.todayCheckOuts}명
            </p>
            {stats.attendance.suspicious > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                의심 {stats.attendance.suspicious}건
              </p>
            )}
          </CardContent>
        </Card>

        {/* 연차 신청 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/leave-management')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              연차 신청
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {stats.leaves.pending}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              대기중 / 이번달 {stats.leaves.thisMonth}건
            </p>
          </CardContent>
        </Card>

        {/* 알림 */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/notifications')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              시스템 알림
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.activities.recent.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              최근 활동
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 하단 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 활동 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                최근 활동
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/activity-log')}
              >
                전체보기
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.activities.recent.length === 0 ? (
                <p className="text-gray-500 text-center py-4">활동 내역이 없습니다</p>
              ) : (
                stats.activities.recent.map((activity: any) => (
                  <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Activity className="w-4 h-4 mt-0.5 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.user?.name || '시스템'} • {new Date(activity.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* 빠른 액션 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              빠른 액션
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => router.push('/schedule')}
              >
                <Calendar className="w-6 h-6" />
                <span className="text-sm">스케줄 관리</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => router.push('/staff')}
              >
                <Users className="w-6 h-6" />
                <span className="text-sm">직원 관리</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => router.push('/leave-management')}
              >
                <CheckCircle className="w-6 h-6" />
                <span className="text-sm">연차 승인</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => router.push('/attendance/statistics')}
              >
                <TrendingUp className="w-6 h-6" />
                <span className="text-sm">출퇴근 통계</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
