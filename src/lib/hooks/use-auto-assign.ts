import { useMutation, useQueryClient } from '@tanstack/react-query'

interface AutoAssignResult {
  success: boolean
  assignments: any[]
  errors: string[]
}

export function useAutoAssign() {
  const queryClient = useQueryClient()

  // 일별 자동 배치
  const assignDaily = useMutation({
    mutationFn: async (slotId: string) => {
      const response = await fetch('/api/auto-assign/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId })
      })
      const result = await response.json()
      return result as AutoAssignResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      queryClient.invalidateQueries({ queryKey: ['slots'] })
    }
  })

  // 주간 자동 배치
  const assignWeekly = useMutation({
    mutationFn: async (startDate: string) => {
      const response = await fetch('/api/auto-assign/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate })
      })
      const result = await response.json()
      return result as AutoAssignResult
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] })
      queryClient.invalidateQueries({ queryKey: ['weekInfo'] })
    }
  })

  return {
    assignDaily: assignDaily.mutate,
    assignWeekly: assignWeekly.mutate,
    isDailyAssigning: assignDaily.isPending,
    isWeeklyAssigning: assignWeekly.isPending,
    dailyResult: assignDaily.data,
    weeklyResult: assignWeekly.data,
    dailyError: assignDaily.error,
    weeklyError: assignWeekly.error
  }
}
