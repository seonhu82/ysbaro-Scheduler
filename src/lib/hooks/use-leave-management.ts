// 연차 관리 훅

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface LeaveApplication {
  id: string
  staffId: string
  staffName: string
  slotId: string
  slotDate: Date
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  appliedAt: Date
  processedAt: Date | null
  processedBy: string | null
  rejectionReason: string | null
}

interface LeavePeriod {
  id: string
  year: number
  month: number
  weekNumber: number
  startDate: Date
  endDate: Date
  status: 'OPEN' | 'CLOSED' | 'CONFIRMED'
  totalSlots: number
  availableSlots: number
  applications: LeaveApplication[]
}

interface SlotStatus {
  date: Date
  totalSlots: number
  appliedSlots: number
  availableSlots: number
  isAvailable: boolean
}

export function useLeaveManagement(periodId?: string) {
  const queryClient = useQueryClient()

  // 연차 신청 기간 목록 조회
  const { data: periods, isLoading: isLoadingPeriods } = useQuery({
    queryKey: ['leave-periods'],
    queryFn: async () => {
      const response = await fetch('/api/leave-management/period')
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch leave periods')
      }
      return result.data as LeavePeriod[]
    }
  })

  // 특정 기간 상세 조회
  const { data: period, isLoading: isLoadingPeriod } = useQuery({
    queryKey: ['leave-period', periodId],
    queryFn: async () => {
      if (!periodId) return null
      const response = await fetch(`/api/leave-management/period/${periodId}`)
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch leave period')
      }
      return result.data as LeavePeriod
    },
    enabled: !!periodId
  })

  // 신청 목록 조회 (관리자용)
  const { data: applications, isLoading: isLoadingApplications } = useQuery({
    queryKey: ['leave-applications', periodId],
    queryFn: async () => {
      const url = periodId
        ? `/api/leave-management?periodId=${periodId}`
        : '/api/leave-management'
      const response = await fetch(url)
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch applications')
      }
      return result.data as LeaveApplication[]
    }
  })

  // 슬롯 상태 조회 (직원용 신청 화면)
  const { data: slotStatus, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['leave-slots', periodId],
    queryFn: async () => {
      if (!periodId) return []
      const response = await fetch(
        `/api/leave-management/period/${periodId}/slots`
      )
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch slot status')
      }
      return result.data as SlotStatus[]
    },
    enabled: !!periodId
  })

  // 연차 신청 기간 생성
  const createPeriod = useMutation({
    mutationFn: async (data: {
      year: number
      month: number
      weekNumber: number
      startDate: string
      endDate: string
    }) => {
      const response = await fetch('/api/leave-management/period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to create leave period')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-periods'] })
    }
  })

  // 신청 승인
  const approveApplication = useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await fetch(`/api/leave-management/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to approve application')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] })
      queryClient.invalidateQueries({ queryKey: ['leave-period', periodId] })
      queryClient.invalidateQueries({ queryKey: ['leave-slots', periodId] })
    }
  })

  // 신청 거부
  const rejectApplication = useMutation({
    mutationFn: async ({
      applicationId,
      reason
    }: {
      applicationId: string
      reason: string
    }) => {
      const response = await fetch(`/api/leave-management/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', rejectionReason: reason })
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to reject application')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-applications'] })
      queryClient.invalidateQueries({ queryKey: ['leave-period', periodId] })
      queryClient.invalidateQueries({ queryKey: ['leave-slots', periodId] })
    }
  })

  // 기간 마감
  const closePeriod = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await fetch(
        `/api/leave-management/period/${periodId}/close`,
        {
          method: 'POST'
        }
      )
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to close period')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-periods'] })
      queryClient.invalidateQueries({ queryKey: ['leave-period', periodId] })
    }
  })

  // 기간 확정
  const confirmPeriod = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await fetch(
        `/api/leave-management/period/${periodId}/confirm`,
        {
          method: 'POST'
        }
      )
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to confirm period')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-periods'] })
      queryClient.invalidateQueries({ queryKey: ['leave-period', periodId] })
    }
  })

  // 기간 재오픈
  const reopenPeriod = useMutation({
    mutationFn: async (periodId: string) => {
      const response = await fetch(
        `/api/leave-management/period/${periodId}/reopen`,
        {
          method: 'POST'
        }
      )
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to reopen period')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-periods'] })
      queryClient.invalidateQueries({ queryKey: ['leave-period', periodId] })
    }
  })

  return {
    periods,
    period,
    applications,
    slotStatus,
    isLoading:
      isLoadingPeriods ||
      isLoadingPeriod ||
      isLoadingApplications ||
      isLoadingSlots,
    isLoadingPeriods,
    isLoadingPeriod,
    isLoadingApplications,
    isLoadingSlots,
    createPeriod: createPeriod.mutate,
    approveApplication: approveApplication.mutate,
    rejectApplication: rejectApplication.mutate,
    closePeriod: closePeriod.mutate,
    confirmPeriod: confirmPeriod.mutate,
    reopenPeriod: reopenPeriod.mutate,
    isCreatingPeriod: createPeriod.isPending,
    isApproving: approveApplication.isPending,
    isRejecting: rejectApplication.isPending,
    isClosing: closePeriod.isPending,
    isConfirming: confirmPeriod.isPending,
    isReopening: reopenPeriod.isPending,
    createError: createPeriod.error,
    approveError: approveApplication.error,
    rejectError: rejectApplication.error,
    closeError: closePeriod.error,
    confirmError: confirmPeriod.error,
    reopenError: reopenPeriod.error
  }
}
