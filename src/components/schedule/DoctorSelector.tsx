'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Stethoscope } from 'lucide-react'

interface Doctor {
  id: string
  name: string
  rank: string
  isActive: boolean
}

interface DoctorSelectorProps {
  selectedDoctors: string[]
  onSelectionChange: (doctorIds: string[]) => void
  date: Date
}

export function DoctorSelector({
  selectedDoctors,
  onSelectionChange,
  date
}: DoctorSelectorProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/doctors')
      const result = await response.json()
      if (result.success) {
        setDoctors(result.data.filter((d: Doctor) => d.isActive))
      }
    } catch (error) {
      console.error('Failed to fetch doctors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (doctorId: string) => {
    if (selectedDoctors.includes(doctorId)) {
      onSelectionChange(selectedDoctors.filter((id) => id !== doctorId))
    } else {
      onSelectionChange([...selectedDoctors, doctorId])
    }
  }

  const getRankLabel = (rank: string) => {
    const labels: Record<string, string> = {
      DOCTOR: '원장',
      ASSOCIATE: '부원장',
      RESIDENT: '레지던트'
    }
    return labels[rank] || rank
  }

  const dayOfWeek = date.getDay()

  if (loading) {
    return <p className="text-center py-4 text-gray-500">로딩 중...</p>
  }

  if (doctors.length === 0) {
    return <p className="text-center py-4 text-gray-500">등록된 원장이 없습니다</p>
  }

  return (
    <div className="space-y-3">
      {doctors.map((doctor) => {
        const isSelected = selectedDoctors.includes(doctor.id)

        return (
          <button
            key={doctor.id}
            onClick={() => handleToggle(doctor.id)}
            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
              isSelected
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Stethoscope
                  className={`w-5 h-5 ${
                    isSelected ? 'text-blue-600' : 'text-gray-600'
                  }`}
                />
                <div>
                  <p className="font-semibold">{doctor.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {getRankLabel(doctor.rank)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isSelected && (
                  <Badge variant="default">선택됨</Badge>
                )}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="w-5 h-5"
                />
              </div>
            </div>
          </button>
        )
      })}

      {selectedDoctors.length > 0 && (
        <div className="pt-3 border-t">
          <p className="text-sm text-gray-600">
            선택된 원장: {selectedDoctors.length}명
          </p>
        </div>
      )}
    </div>
  )
}
