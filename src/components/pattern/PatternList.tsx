'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Edit, Trash2, Check } from 'lucide-react'

interface DoctorPattern {
  id: string
  patternName: string
  isActive: boolean
  doctor: {
    id: string
    name: string
    specialization: string | null
  }
  days: {
    dayOfWeek: number
    isWorkday: boolean
    hasNightShift: boolean
  }[]
}

interface PatternListProps {
  doctorId?: string
  onEdit?: (pattern: DoctorPattern) => void
  onDelete?: (patternId: string) => void
  onActivate?: (patternId: string) => void
}

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토']

export function PatternList({ doctorId, onEdit, onDelete, onActivate }: PatternListProps) {
  const [patterns, setPatterns] = useState<DoctorPattern[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPatterns()
  }, [doctorId])

  const fetchPatterns = async () => {
    try {
      setLoading(true)
      const url = doctorId
        ? `/api/doctor-pattern?doctorId=${doctorId}`
        : '/api/doctor-pattern'

      const response = await fetch(url)
      const result = await response.json()

      if (result.success && result.data) {
        setPatterns(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch patterns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (patternId: string) => {
    if (!confirm('이 패턴을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/doctor-pattern/${patternId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setPatterns(patterns.filter(p => p.id !== patternId))
        onDelete?.(patternId)
      }
    } catch (error) {
      console.error('Failed to delete pattern:', error)
    }
  }

  const handleActivate = async (patternId: string) => {
    try {
      const response = await fetch(`/api/doctor-pattern/${patternId}/activate`, {
        method: 'POST'
      })

      if (response.ok) {
        await fetchPatterns()
        onActivate?.(patternId)
      }
    } catch (error) {
      console.error('Failed to activate pattern:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (patterns.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        등록된 패턴이 없습니다
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {patterns.map((pattern) => (
        <Card key={pattern.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{pattern.patternName}</span>
                {pattern.isActive && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    <Check className="w-3 h-3 mr-1" />
                    활성
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {!pattern.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleActivate(pattern.id)}
                  >
                    활성화
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit?.(pattern)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(pattern.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                원장: {pattern.doctor.name}
                {pattern.doctor.specialization && (
                  <span className="text-gray-500 ml-2">({pattern.doctor.specialization})</span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {pattern.days.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className={`px-3 py-1 rounded text-sm ${
                      day.isWorkday
                        ? day.hasNightShift
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {DAYS_KR[day.dayOfWeek]}
                    {day.hasNightShift && ' 🌙'}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
