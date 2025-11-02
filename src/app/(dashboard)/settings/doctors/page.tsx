'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Save, Edit2, Trash2, Plus } from 'lucide-react'
import { DoctorInfoStep } from '@/components/setup/DoctorInfoStep'

interface Doctor {
  name: string
  shortName: string
  useCategory: boolean
  categories: Array<{
    name: string
    shortName: string
  }>
}

export default function DoctorsSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Doctor | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  // 데이터 로드
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch('/api/doctors')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            // API 데이터를 DoctorInfoStep 형식으로 변환
            const formattedDoctors: Doctor[] = data.data.map((d: any) => ({
              name: d.name,
              shortName: d.shortName || '',
              useCategory: d.useCategory || false,
              categories: [] // TODO: DoctorCategory 테이블에서 가져오기
            }))
            setDoctors(formattedDoctors)
          }
        }
      } catch (error) {
        console.error('Failed to fetch doctors:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDoctors()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/settings/doctors-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctors })
      })

      if (res.ok) {
        alert('저장되었습니다.')
        window.location.reload()
      } else {
        const error = await res.json()
        alert(`저장 실패: ${error.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEditClick = (index: number) => {
    setEditingIndex(index)
    setEditForm({ ...doctors[index] })
  }

  const handleEditSave = () => {
    if (editForm && editingIndex !== null) {
      const updated = [...doctors]
      updated[editingIndex] = editForm
      setDoctors(updated)
      setEditingIndex(null)
      setEditForm(null)
    }
  }

  const handleDeleteClick = (index: number) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      const updated = doctors.filter((_, i) => i !== index)
      setDoctors(updated)
    }
  }

  const handleAddDoctor = () => {
    setEditingIndex(-1)
    setEditForm({
      name: '',
      shortName: '',
      useCategory: false,
      categories: []
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">원장 관리</h1>
          <p className="text-gray-600 mt-2">원장 정보, 별칭, 구분을 설정합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkEdit(!showBulkEdit)}>
            {showBulkEdit ? '목록 보기' : '일괄 편집'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {showBulkEdit ? (
        <Card>
          <CardContent className="pt-6">
            <DoctorInfoStep data={doctors} onChange={setDoctors} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={handleAddDoctor}>
              <Plus className="w-4 h-4 mr-2" />
              원장 추가
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map((doctor, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg" onClick={() => handleEditClick(index)}>
                      {doctor.name} ({doctor.shortName})
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditClick(index)
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick(index)
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent onClick={() => handleEditClick(index)}>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>
                      구분 사용: {doctor.useCategory ? '예' : '아니오'}
                    </div>
                    {doctor.useCategory && doctor.categories.length > 0 && (
                      <div>
                        카테고리: {doctor.categories.map(c => c.name).join(', ')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* 편집 다이얼로그 */}
      <Dialog open={editingIndex !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingIndex(null)
          setEditForm(null)
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIndex === -1 ? '원장 추가' : '원장 편집'}
            </DialogTitle>
            <DialogDescription>
              원장 정보를 입력하세요
            </DialogDescription>
          </DialogHeader>

          {editForm && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="doctorName">이름</Label>
                <Input
                  id="doctorName"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="원장 이름"
                />
              </div>

              <div>
                <Label htmlFor="doctorShortName">별칭</Label>
                <Input
                  id="doctorShortName"
                  value={editForm.shortName}
                  onChange={(e) => setEditForm({ ...editForm, shortName: e.target.value })}
                  placeholder="별칭"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useCategory"
                  checked={editForm.useCategory}
                  onChange={(e) => setEditForm({ ...editForm, useCategory: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="useCategory">구분 사용</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingIndex(null)
              setEditForm(null)
            }}>
              취소
            </Button>
            <Button onClick={() => {
              if (editingIndex === -1 && editForm) {
                setDoctors([...doctors, editForm])
              } else {
                handleEditSave()
              }
              setEditingIndex(null)
              setEditForm(null)
            }}>
              {editingIndex === -1 ? '추가' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
