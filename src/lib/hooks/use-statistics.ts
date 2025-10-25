// 통계 훅

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface MonthlyStats {
  totalSchedules: number
  totalAssignments: number
  avgStaffPerDay: number
  fairnessScore: number
  nightShiftCount: number
  weekendShiftCount: number
  byRank: Record<string, { count: number; percentage: number }>
}

interface StaffWorkload {
  staffId: string
  staffName: string
  rank: string
  totalShifts: number
  nightShifts: number
  weekendShifts: number
  fairnessScore: number
  grade: string
}

interface MonthlyTrend {
  month: string
  totalSchedules: number
  fairnessScore: number
  nightShiftCount: number
  weekendShiftCount: number
}

export function useStatistics(year: number, month: number) {
  const queryClient = useQueryClient()

  // 월간 통계
  const { data: monthlyStats, isLoading: isLoadingMonthly } = useQuery({
    queryKey: ['statistics', 'monthly', year, month],
    queryFn: async () => {
      const response = await fetch(
        `/api/statistics/monthly?year=${year}&month=${month}`
      )
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch monthly statistics')
      }
      return result.data as MonthlyStats
    }
  })

  // 직원별 업무량
  const { data: staffWorkload, isLoading: isLoadingWorkload } = useQuery({
    queryKey: ['statistics', 'workload', year, month],
    queryFn: async () => {
      const response = await fetch(
        `/api/statistics/workload?year=${year}&month=${month}`
      )
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch staff workload')
      }
      return result.data as StaffWorkload[]
    }
  })

  // 월별 추세 (최근 6개월)
  const { data: monthlyTrend, isLoading: isLoadingTrend } = useQuery({
    queryKey: ['statistics', 'trend', year, month],
    queryFn: async () => {
      const response = await fetch(
        `/api/statistics/trend?year=${year}&month=${month}&months=6`
      )
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch monthly trend')
      }
      return result.data as MonthlyTrend[]
    }
  })

  // 통계 내보내기
  const exportStatistics = useMutation({
    mutationFn: async (format: 'excel' | 'pdf') => {
      const response = await fetch('/api/statistics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, format })
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to export statistics')
      }
      return result.data
    }
  })

  return {
    monthlyStats,
    staffWorkload,
    monthlyTrend,
    isLoading: isLoadingMonthly || isLoadingWorkload || isLoadingTrend,
    isLoadingMonthly,
    isLoadingWorkload,
    isLoadingTrend,
    exportStatistics: exportStatistics.mutate,
    isExporting: exportStatistics.isPending,
    exportError: exportStatistics.error
  }
}
