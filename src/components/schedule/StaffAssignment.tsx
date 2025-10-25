'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Sparkles } from 'lucide-react'

interface Staff {
  id: string
  name: string
  rank: string
  categoryName: string
  workType: string
  isActive: boolean
}

interface StaffAssignmentProps {
  selectedStaff: string[]
  onSelectionChange: (staffIds: string[]) => void
  requiredCount: number
  date: Date
  isWeekend: boolean
  hasNightShift: boolean
}

export function StaffAssignment({
  selectedStaff,
  onSelectionChange,
  requiredCount,
  date,
  isWeekend,
  hasNightShift
}: StaffAssignmentProps) {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [autoAssigning, setAutoAssigning] = useState(false)

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/staff')
      const result = await response.json()
      if (result.success) {
        setStaffList(result.data.filter((s: Staff) => s.isActive))
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (staffId: string) => {
    if (selectedStaff.includes(staffId)) {
      onSelectionChange(selectedStaff.filter((id) => id !== staffId))
    } else {
      if (selectedStaff.length < requiredCount) {
        onSelectionChange([...selectedStaff, staffId])
      } else {
        alert(`최대 ${requiredCount}명까지만 선택할 수 있습니다`)
      }
    }
  }

  const handleAutoAssign = async () => {
    try {
      setAutoAssigning(true)
      // 우선순위 기반 자동 선택 로직
      const sortedStaff = [...staffList].sort((a, b) => {
        // 간단한 우선순위: 직급별, 알파벳순
        if (a.rank !== b.rank) return a.rank.localeCompare(b.rank)
        return a.name.localeCompare(b.name)
      })

      const autoSelected = sortedStaff.slice(0, requiredCount).map(s => s.id)
      onSelectionChange(autoSelected)
      alert('자동 배치가 완료되었습니다')
    } catch (error) {
      console.error('Auto assign failed:', error)
      alert('자동 배치에 실패했습니다')
    } finally {
      setAutoAssigning(false)
    }
  }

  const getRankLabel = (rank: string) => {
    const labels: Record<string, string> = {
      HYGIENIST: '위생사',
      ASSISTANT: '어시스턴트',
      COORDINATOR: '코디네이터',
      NURSE: '간호조무사'
    }
    return labels[rank] || rank
  }

  if (loading) {
    return <p className="text-center py-4 text-gray-500">로딩 중...</p>
  }

  if (staffList.length === 0) {
    return <p className="text-center py-4 text-gray-500">등록된 직원이 없습니다</p>
  }

  return (
    <div className="space-y-4">
      {/* 자동 배치 버튼 */}
      <div className="flex items-center justify-between pb-3 border-b">
        <p className="text-sm text-gray-600">
          {selectedStaff.length} / {requiredCount}명 선택됨
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAutoAssign}
          disabled={autoAssigning}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {autoAssigning ? '배치 중...' : '자동 배치'}
        </Button>
      </div>

      {/* 직원 목록 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {staffList.map((staff) => {
          const isSelected = selectedStaff.includes(staff.id)
          const canSelect = selectedStaff.length < requiredCount || isSelected

          return (
            <button
              key={staff.id}
              onClick={() => handleToggle(staff.id)}
              disabled={!canSelect}
              className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : canSelect
                  ? 'border-gray-200 hover:border-gray-300'
                  : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users
                    className={`w-4 h-4 ${
                      isSelected ? 'text-blue-600' : 'text-gray-600'
                    }`}
                  />
                  <div>
                    <p className="font-medium">{staff.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getRankLabel(staff.rank)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {staff.categoryName}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {staff.workType === 'WEEK_4' ? '주4일' : '주5일'}
                      </span>
                    </div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  disabled={!canSelect}
                  className="w-4 h-4"
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* 경고 메시지 */}
      {selectedStaff.length < requiredCount && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            아직 {requiredCount - selectedStaff.length}명의 직원을 더 선택해야 합니다
          </p>
        </div>
      )}

      {isWeekend && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm text-orange-800">
            주말 근무입니다. 형평성을 고려하여 배치해주세요.
          </p>
        </div>
      )}

      {hasNightShift && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-sm text-purple-800">
            야간 진료가 있습니다. 야간 근무 가능한 직원을 배치해주세요.
          </p>
        </div>
      )}
    </div>
  )
}
