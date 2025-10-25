'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Edit, Trash2, Stethoscope, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Doctor {
  id: string
  name: string
  rank: string
  isActive: boolean
  patterns: Array<{
    id: string
    patternName: string
    isActive: boolean
  }>
}

export function DoctorManager() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    rank: 'DOCTOR'
  })

  useEffect(() => {
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/doctors')
      const result = await response.json()
      if (result.success) {
        setDoctors(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch doctors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddDoctor = async () => {
    try {
      const response = await fetch('/api/settings/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setIsAddDialogOpen(false)
        setFormData({ name: '', rank: 'DOCTOR' })
        fetchDoctors()
      }
    } catch (error) {
      console.error('Failed to add doctor:', error)
    }
  }

  const handleEditDoctor = (doctor: Doctor) => {
    setEditingDoctor(doctor)
    setFormData({
      name: doctor.name,
      rank: doctor.rank
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateDoctor = async () => {
    if (!editingDoctor) return

    try {
      const response = await fetch(`/api/settings/doctors/${editingDoctor.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        fetchDoctors()
        setIsEditDialogOpen(false)
        setEditingDoctor(null)
        setFormData({ name: '', rank: 'DOCTOR' })
      }
    } catch (error) {
      console.error('Failed to update doctor:', error)
    }
  }

  const handleDeleteDoctor = async (id: string) => {
    if (!confirm('이 원장을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/settings/doctors/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchDoctors()
      }
    } catch (error) {
      console.error('Failed to delete doctor:', error)
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="w-6 h-6" />
            원장 관리
          </h2>
          <p className="text-gray-600 mt-1">원장 정보 및 근무 패턴을 관리합니다</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          원장 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전체 원장 ({doctors.length}명)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-gray-500">로딩 중...</p>
          ) : doctors.length === 0 ? (
            <p className="text-center py-8 text-gray-500">등록된 원장이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {doctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{doctor.name}</span>
                      <Badge variant="outline">{getRankLabel(doctor.rank)}</Badge>
                      {!doctor.isActive && (
                        <Badge variant="destructive">비활성</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditDoctor(doctor)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteDoctor(doctor.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* 패턴 목록 */}
                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">근무 패턴</span>
                    </div>
                    {doctor.patterns && doctor.patterns.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {doctor.patterns.map((pattern) => (
                          <Badge
                            key={pattern.id}
                            variant={pattern.isActive ? 'default' : 'outline'}
                          >
                            {pattern.patternName}
                            {pattern.isActive && ' (활성)'}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">등록된 패턴이 없습니다</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 원장 추가 다이얼로그 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>원장 추가</DialogTitle>
            <DialogDescription>새로운 원장 정보를 입력하세요</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="원장 이름"
              />
            </div>

            <div>
              <Label htmlFor="rank">직급</Label>
              <select
                id="rank"
                value={formData.rank}
                onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="DOCTOR">원장</option>
                <option value="ASSOCIATE">부원장</option>
                <option value="RESIDENT">레지던트</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddDoctor}>추가</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 원장 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>원장 정보 수정</DialogTitle>
            <DialogDescription>
              원장의 정보를 수정합니다
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">이름</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="원장 이름"
              />
            </div>

            <div>
              <Label htmlFor="edit-rank">직급</Label>
              <select
                id="edit-rank"
                value={formData.rank}
                onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="DOCTOR">원장</option>
                <option value="ASSOCIATE">부원장</option>
                <option value="RESIDENT">레지던트</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingDoctor(null)
                setFormData({ name: '', rank: 'DOCTOR' })
              }}
            >
              취소
            </Button>
            <Button onClick={handleUpdateDoctor}>수정</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
