'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Stethoscope,
  Plus,
  Edit,
  Trash2,
  Calendar,
  UserCheck,
  UserX,
} from 'lucide-react'
import { DoctorForm } from './DoctorForm'
import { useToast } from '@/hooks/use-toast'

export interface DoctorPatternDay {
  id: string
  dayOfWeek: number
  isWorkday: boolean
  hasNightShift: boolean
}

export interface DoctorPattern {
  id: string
  patternName: string
  isActive: boolean
  days: DoctorPatternDay[]
}

export interface Doctor {
  id: string
  name: string
  specialization?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  patterns: DoctorPattern[]
}

interface DoctorListProps {
  doctors: Doctor[]
  onUpdate: () => void
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function DoctorList({ doctors, onUpdate }: DoctorListProps) {
  const { toast } = useToast()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const handleAdd = () => {
    setEditingDoctor(null)
    setIsFormOpen(true)
  }

  const handleEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor)
    setIsFormOpen(true)
  }

  const handleDelete = async (doctor: Doctor) => {
    if (!confirm(`${doctor.name} 원장을 삭제하시겠습니까? (비활성화됩니다)`)) {
      return
    }

    try {
      const response = await fetch(`/api/doctors/${doctor.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '삭제 완료',
          description: `${doctor.name} 원장이 비활성화되었습니다.`,
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
    setEditingDoctor(null)
    if (saved) {
      onUpdate()
    }
  }

  const filteredDoctors = showInactive
    ? doctors
    : doctors.filter((d) => d.isActive)

  const getWorkdayPattern = (doctor: Doctor) => {
    if (!doctor.patterns || doctor.patterns.length === 0) {
      return '패턴 없음'
    }

    const pattern = doctor.patterns[0]
    const workdays = pattern.days
      .filter((d) => d.isWorkday)
      .map((d) => DAY_LABELS[d.dayOfWeek])
      .join(', ')

    const nightShifts = pattern.days
      .filter((d) => d.hasNightShift)
      .map((d) => DAY_LABELS[d.dayOfWeek])

    if (nightShifts.length > 0) {
      return `${workdays} (야간: ${nightShifts.join(', ')})`
    }

    return workdays || '휴무'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="w-6 h-6" />
            원장 목록
          </h2>
          <Badge variant="outline">{filteredDoctors.length}명</Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? '활성 원장만 보기' : '비활성 원장 포함'}
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            원장 추가
          </Button>
        </div>
      </div>

      {filteredDoctors.length === 0 ? (
        <Card className="p-12 text-center">
          <Stethoscope className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 mb-4">등록된 원장이 없습니다.</p>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            첫 원장 추가하기
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDoctors.map((doctor) => (
            <Card key={doctor.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {doctor.isActive ? (
                    <UserCheck className="w-5 h-5 text-green-600" />
                  ) : (
                    <UserX className="w-5 h-5 text-gray-400" />
                  )}
                  <h3 className="text-xl font-bold">{doctor.name}</h3>
                </div>
                {!doctor.isActive && (
                  <Badge variant="secondary">비활성</Badge>
                )}
              </div>

              {doctor.specialization && (
                <div className="mb-3">
                  <Badge variant="outline" className="text-sm">
                    {doctor.specialization}
                  </Badge>
                </div>
              )}

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="font-medium">근무 패턴</span>
                </div>
                <p className="text-sm">{getWorkdayPattern(doctor)}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleEdit(doctor)}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  수정
                </Button>
                {doctor.isActive && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(doctor)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {isFormOpen && (
        <DoctorForm
          doctor={editingDoctor}
          isOpen={isFormOpen}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
