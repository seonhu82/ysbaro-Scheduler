/**
 * 원장 패턴 관리 페이지
 * 경로: /settings/doctors/pattern
 *
 * 기능:
 * - 원장별 근무 패턴 관리
 * - 요일별 근무 여부 설정
 * - 야간 근무 설정
 * - 패턴 활성화/비활성화
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserCog, Plus, Save, Trash2, RefreshCw, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DoctorPattern {
  id: string
  doctorId: string
  doctorName: string
  patternName: string
  isActive: boolean
  days: {
    dayOfWeek: number
    isWorkday: boolean
    hasNightShift: boolean
  }[]
}

interface Doctor {
  id: string
  name: string
}

const DAYS_OF_WEEK = [
  { value: 0, label: '일요일', short: '일' },
  { value: 1, label: '월요일', short: '월' },
  { value: 2, label: '화요일', short: '화' },
  { value: 3, label: '수요일', short: '수' },
  { value: 4, label: '목요일', short: '목' },
  { value: 5, label: '금요일', short: '금' },
  { value: 6, label: '토요일', short: '토' },
]

export default function DoctorPatternPage() {
  const { toast } = useToast()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patterns, setPatterns] = useState<DoctorPattern[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [newPatternName, setNewPatternName] = useState('')
  const [editingPattern, setEditingPattern] = useState<DoctorPattern | null>(null)

  useEffect(() => {
    fetchDoctors()
    fetchPatterns()
  }, [])

  const fetchDoctors = async () => {
    try {
      const response = await fetch('/api/settings/doctors')
      const data = await response.json()

      if (data.success) {
        setDoctors(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch doctors:', error)
    }
  }

  const fetchPatterns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/doctors/patterns')
      const data = await response.json()

      if (data.success) {
        setPatterns(data.data || [])
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePattern = async () => {
    if (!selectedDoctorId || !newPatternName) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '원장과 패턴명을 입력해주세요'
      })
      return
    }

    try {
      const response = await fetch('/api/settings/doctors/patterns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          patternName: newPatternName
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '패턴 생성 완료',
          description: '새 패턴이 생성되었습니다'
        })
        setNewPatternName('')
        setSelectedDoctorId('')
        fetchPatterns()
      } else {
        toast({
          variant: 'destructive',
          title: '생성 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    }
  }

  const handleUpdatePattern = async (pattern: DoctorPattern) => {
    try {
      const response = await fetch(`/api/settings/doctors/patterns/${pattern.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isActive: pattern.isActive,
          days: pattern.days
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '저장 완료',
          description: '패턴이 업데이트되었습니다'
        })
        setEditingPattern(null)
        fetchPatterns()
      } else {
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    }
  }

  const handleDeletePattern = async (patternId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/settings/doctors/patterns/${patternId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '삭제 완료',
          description: '패턴이 삭제되었습니다'
        })
        fetchPatterns()
      } else {
        toast({
          variant: 'destructive',
          title: '삭제 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    }
  }

  const toggleWorkday = (pattern: DoctorPattern, dayOfWeek: number) => {
    const dayIndex = pattern.days.findIndex(d => d.dayOfWeek === dayOfWeek)
    if (dayIndex !== -1) {
      const updatedDays = [...pattern.days]
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        isWorkday: !updatedDays[dayIndex].isWorkday,
        hasNightShift: false // 근무일이 아니면 야간도 false
      }
      setEditingPattern({
        ...pattern,
        days: updatedDays
      })
    }
  }

  const toggleNightShift = (pattern: DoctorPattern, dayOfWeek: number) => {
    const dayIndex = pattern.days.findIndex(d => d.dayOfWeek === dayOfWeek)
    if (dayIndex !== -1 && pattern.days[dayIndex].isWorkday) {
      const updatedDays = [...pattern.days]
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        hasNightShift: !updatedDays[dayIndex].hasNightShift
      }
      setEditingPattern({
        ...pattern,
        days: updatedDays
      })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <UserCog className="w-7 h-7" />
          원장 패턴 관리
        </h1>
        <p className="text-gray-600">
          원장별 근무 패턴을 설정하고 관리합니다
        </p>
      </div>

      {/* 패턴 생성 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>새 패턴 생성</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>원장 선택</Label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="원장 선택" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="patternName">패턴명</Label>
              <Input
                id="patternName"
                placeholder="예: 기본 패턴, 여름 패턴"
                value={newPatternName}
                onChange={(e) => setNewPatternName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreatePattern} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                패턴 생성
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 패턴 목록 */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-500" />
                <p className="text-gray-500">로딩 중...</p>
              </div>
            </CardContent>
          </Card>
        ) : patterns.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">등록된 패턴이 없습니다</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          patterns.map((pattern) => {
            const isEditing = editingPattern?.id === pattern.id
            const displayPattern = isEditing ? editingPattern : pattern

            return (
              <Card key={pattern.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3">
                        {pattern.doctorName} - {pattern.patternName}
                        {pattern.isActive ? (
                          <Badge variant="default">활성</Badge>
                        ) : (
                          <Badge variant="outline">비활성</Badge>
                        )}
                      </CardTitle>
                    </div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPattern(null)}
                          >
                            취소
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdatePattern(editingPattern)}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            저장
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPattern(pattern)}
                          >
                            편집
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePattern(pattern.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* 활성화 토글 */}
                    {isEditing && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <Label>패턴 활성화</Label>
                        <Switch
                          checked={displayPattern.isActive}
                          onCheckedChange={(checked) =>
                            setEditingPattern({
                              ...editingPattern,
                              isActive: checked
                            })
                          }
                        />
                      </div>
                    )}

                    {/* 요일별 설정 */}
                    <div className="grid grid-cols-7 gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const dayData = displayPattern.days.find(d => d.dayOfWeek === day.value)
                        const isWorkday = dayData?.isWorkday || false
                        const hasNightShift = dayData?.hasNightShift || false

                        return (
                          <div
                            key={day.value}
                            className={`p-3 border rounded-lg text-center ${
                              isWorkday ? 'bg-blue-50 border-blue-300' : 'bg-gray-50'
                            }`}
                          >
                            <div className="font-medium mb-2">{day.short}</div>
                            {isEditing ? (
                              <div className="space-y-2">
                                <Button
                                  variant={isWorkday ? 'default' : 'outline'}
                                  size="sm"
                                  className="w-full text-xs"
                                  onClick={() => toggleWorkday(editingPattern, day.value)}
                                >
                                  {isWorkday ? '근무' : '휴무'}
                                </Button>
                                {isWorkday && (
                                  <Button
                                    variant={hasNightShift ? 'secondary' : 'outline'}
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => toggleNightShift(editingPattern, day.value)}
                                  >
                                    {hasNightShift ? '야간O' : '야간X'}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Badge variant={isWorkday ? 'default' : 'outline'} className="text-xs">
                                  {isWorkday ? '근무' : '휴무'}
                                </Badge>
                                {isWorkday && hasNightShift && (
                                  <Badge variant="secondary" className="text-xs block">
                                    야간
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
