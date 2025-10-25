// 패턴 훅

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface DayPattern {
  dayOfWeek: number
  isWorkday: boolean
  hasNightShift: boolean
}

interface DoctorPattern {
  id: string
  doctorId: string
  patternName: string
  isActive: boolean
  days: DayPattern[]
  createdAt: Date
  updatedAt: Date
}

interface CreatePatternData {
  doctorId: string
  patternName: string
  days: DayPattern[]
}

export function usePattern(doctorId?: string) {
  const queryClient = useQueryClient()

  // 원장의 모든 패턴 조회
  const { data: patterns, isLoading: isLoadingPatterns } = useQuery({
    queryKey: ['patterns', doctorId],
    queryFn: async () => {
      if (!doctorId) return []
      const response = await fetch(`/api/settings/doctors/${doctorId}/patterns`)
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch patterns')
      }
      return result.data as DoctorPattern[]
    },
    enabled: !!doctorId
  })

  // 활성 패턴 조회
  const { data: activePattern, isLoading: isLoadingActive } = useQuery({
    queryKey: ['patterns', doctorId, 'active'],
    queryFn: async () => {
      if (!doctorId) return null
      const response = await fetch(
        `/api/settings/doctors/${doctorId}/patterns?active=true`
      )
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch active pattern')
      }
      return result.data as DoctorPattern | null
    },
    enabled: !!doctorId
  })

  // 패턴 생성
  const createPattern = useMutation({
    mutationFn: async (data: CreatePatternData) => {
      const response = await fetch('/api/settings/doctors/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to create pattern')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns', doctorId] })
    }
  })

  // 패턴 수정
  const updatePattern = useMutation({
    mutationFn: async ({
      patternId,
      data
    }: {
      patternId: string
      data: Partial<CreatePatternData>
    }) => {
      const response = await fetch(`/api/settings/doctors/patterns/${patternId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to update pattern')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns', doctorId] })
      queryClient.invalidateQueries({ queryKey: ['patterns', doctorId, 'active'] })
    }
  })

  // 패턴 활성화
  const activatePattern = useMutation({
    mutationFn: async (patternId: string) => {
      const response = await fetch(
        `/api/settings/doctors/patterns/${patternId}/activate`,
        {
          method: 'POST'
        }
      )
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to activate pattern')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns', doctorId] })
      queryClient.invalidateQueries({ queryKey: ['patterns', doctorId, 'active'] })
    }
  })

  // 패턴 삭제
  const deletePattern = useMutation({
    mutationFn: async (patternId: string) => {
      const response = await fetch(`/api/settings/doctors/patterns/${patternId}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete pattern')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns', doctorId] })
      queryClient.invalidateQueries({ queryKey: ['patterns', doctorId, 'active'] })
    }
  })

  return {
    patterns,
    activePattern,
    isLoading: isLoadingPatterns || isLoadingActive,
    isLoadingPatterns,
    isLoadingActive,
    createPattern: createPattern.mutate,
    updatePattern: updatePattern.mutate,
    activatePattern: activatePattern.mutate,
    deletePattern: deletePattern.mutate,
    isCreating: createPattern.isPending,
    isUpdating: updatePattern.isPending,
    isActivating: activatePattern.isPending,
    isDeleting: deletePattern.isPending,
    createError: createPattern.error,
    updateError: updatePattern.error,
    activateError: activatePattern.error,
    deleteError: deletePattern.error
  }
}
