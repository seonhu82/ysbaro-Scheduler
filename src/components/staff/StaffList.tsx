'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  UserCheck,
  UserX,
} from 'lucide-react'
import { StaffForm } from './StaffForm'
import { useToast } from '@/hooks/use-toast'

export type StaffRank = 'HYGIENIST' | 'ASSISTANT' | 'COORDINATOR' | 'NURSE' | 'OTHER'

export interface Staff {
  id: string
  name: string
  rank: StaffRank
  phoneNumber?: string | null
  email?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface StaffListProps {
  staff: Staff[]
  onUpdate: () => void
}

const RANK_LABELS: Record<StaffRank, string> = {
  HYGIENIST: '위생사',
  ASSISTANT: '어시스턴트',
  COORDINATOR: '코디네이터',
  NURSE: '간호조무사',
  OTHER: '기타',
}

const RANK_COLORS: Record<StaffRank, string> = {
  HYGIENIST: 'bg-blue-100 text-blue-800',
  ASSISTANT: 'bg-green-100 text-green-800',
  COORDINATOR: 'bg-purple-100 text-purple-800',
  NURSE: 'bg-pink-100 text-pink-800',
  OTHER: 'bg-gray-100 text-gray-800',
}

export function StaffList({ staff, onUpdate }: StaffListProps) {
  const { toast } = useToast()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const handleAdd = () => {
    setEditingStaff(null)
    setIsFormOpen(true)
  }

  const handleEdit = (s: Staff) => {
    setEditingStaff(s)
    setIsFormOpen(true)
  }

  const handleDelete = async (s: Staff) => {
    if (!confirm(`${s.name} 직원을 삭제하시겠습니까? (비활성화됩니다)`)) {
      return
    }

    try {
      const response = await fetch(`/api/staff/${s.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '삭제 완료',
          description: `${s.name} 직원이 비활성화되었습니다.`,
        })
        onUpdate()
      } else {
        throw new Error(result.error || '삭제 실패')
      }
    } catch (error: any) {
      toast({
        title: '삭제 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    }
  }

  const handleFormClose = (saved: boolean) => {
    setIsFormOpen(false)
    setEditingStaff(null)
    if (saved) {
      onUpdate()
    }
  }

  const filteredStaff = showInactive
    ? staff
    : staff.filter((s) => s.isActive)

  // 직급별 그룹화
  const groupedStaff = filteredStaff.reduce((acc, s) => {
    if (!acc[s.rank]) {
      acc[s.rank] = []
    }
    acc[s.rank].push(s)
    return acc
  }, {} as Record<StaffRank, Staff[]>)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            직원 목록
          </h2>
          <Badge variant="outline">
            {filteredStaff.length}명
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? '활성 직원만 보기' : '비활성 직원 포함'}
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            직원 추가
          </Button>
        </div>
      </div>

      {Object.entries(groupedStaff).length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 mb-4">등록된 직원이 없습니다.</p>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            첫 직원 추가하기
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedStaff).map(([rank, staffList]) => (
            <Card key={rank} className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <h3 className="text-lg font-semibold">
                  {RANK_LABELS[rank as StaffRank]}
                </h3>
                <Badge variant="outline">{staffList.length}명</Badge>
              </div>

              <div className="space-y-2">
                {staffList.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {s.isActive ? (
                          <UserCheck className="w-5 h-5 text-green-600" />
                        ) : (
                          <UserX className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="font-medium text-lg">{s.name}</span>
                      </div>

                      <Badge className={RANK_COLORS[s.rank]}>
                        {RANK_LABELS[s.rank]}
                      </Badge>

                      {!s.isActive && (
                        <Badge variant="secondary">비활성</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {s.phoneNumber && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {s.phoneNumber}
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          {s.email}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(s)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          수정
                        </Button>
                        {s.isActive && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(s)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            삭제
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {isFormOpen && (
        <StaffForm
          staff={editingStaff}
          isOpen={isFormOpen}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
