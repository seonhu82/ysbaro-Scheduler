import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ScheduleData {
  id: string
  year: number
  month: number
  status: string
  doctors: any[]
  staffAssignments: any[]
}

export function useSchedule(year: number, month: number) {
  const queryClient = useQueryClient()

  // 스케줄 조회
  const { data, isLoading, error } = useQuery({
    queryKey: ['schedule', year, month],
    queryFn: async () => {
      const response = await fetch(`/api/schedule?year=${year}&month=${month}`)
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch schedule')
      }
      return result.data as ScheduleData
    }
  })

  // 스케줄 생성/업데이트
  const updateSchedule = useMutation({
    mutationFn: async (scheduleData: Partial<ScheduleData>) => {
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, ...scheduleData })
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to update schedule')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', year, month] })
    }
  })

  // 스케줄 확정
  const confirmSchedule = useMutation({
    mutationFn: async (scheduleId: string) => {
      const response = await fetch(`/api/schedule/${scheduleId}/confirm`, {
        method: 'PATCH'
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to confirm schedule')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', year, month] })
    }
  })

  return {
    schedule: data,
    isLoading,
    error,
    updateSchedule: updateSchedule.mutate,
    confirmSchedule: confirmSchedule.mutate,
    isUpdating: updateSchedule.isPending,
    isConfirming: confirmSchedule.isPending
  }
}
