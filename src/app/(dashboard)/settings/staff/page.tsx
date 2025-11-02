'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Save, Edit2, Trash2, Plus } from 'lucide-react'
import { StaffRegistrationStep } from '@/components/setup/StaffRegistrationStep'

interface Staff {
  name: string
  birthDate: string
  departmentName: string
  categoryName: string
  position: string
  workType: 'WEEK_4' | 'WEEK_5'
  flexibleForCategories: string[]
  flexibilityPriority: number
}

interface Department {
  name: string
  order: number
  useAutoAssignment: boolean
}

interface Category {
  name: string
  priority: number
  order: number
  departmentName: string | null
}

export default function StaffSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [staff, setStaff] = useState<Staff[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Staff | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [staffRes, deptRes, catRes] = await Promise.all([
          fetch('/api/staff?includeInactive=true'),
          fetch('/api/settings/departments'),
          fetch('/api/settings/categories')
        ])

        const [staffData, deptData, catData] = await Promise.all([
          staffRes.json(),
          deptRes.json(),
          catRes.json()
        ])

        if (staffData.success && staffData.data) {
          const formattedStaff: Staff[] = staffData.data.map((s: any) => ({
            name: s.name,
            birthDate: s.birthDateStr || s.birthDate?.toISOString().split('T')[0].replace(/-/g, '').slice(2) || '',
            departmentName: s.departmentName || '',
            categoryName: s.categoryName || '',
            position: s.position || '사원',
            workType: s.workType || 'WEEK_4',
            flexibleForCategories: s.flexibleForCategories || [],
            flexibilityPriority: s.flexibilityPriority || 0,
          }))
          setStaff(formattedStaff)
        }

        if (deptData.success && deptData.data) {
          setDepartments(deptData.data)
          console.log('Departments loaded:', deptData.data)
        }

        if (catData.success && catData.data) {
          setCategories(catData.data)
          console.log('Categories loaded:', catData.data)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/settings/staff-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff })
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
    setEditForm({ ...staff[index] })
  }

  const handleEditSave = () => {
    if (editForm && editingIndex !== null) {
      const updated = [...staff]
      updated[editingIndex] = editForm
      setStaff(updated)
      setEditingIndex(null)
      setEditForm(null)
    }
  }

  const handleDeleteClick = (index: number) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      const updated = staff.filter((_, i) => i !== index)
      setStaff(updated)
    }
  }

  const handleAddStaff = () => {
    setEditingIndex(-1)
    setEditForm({
      name: '',
      birthDate: '',
      departmentName: '',
      categoryName: '',
      position: '사원',
      workType: 'WEEK_4',
      flexibleForCategories: [],
      flexibilityPriority: 0
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
          <h1 className="text-3xl font-bold text-gray-900">직원 관리</h1>
          <p className="text-gray-600 mt-2">직원 정보를 등록하고 관리합니다</p>
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
            <StaffRegistrationStep
              data={staff}
              departments={departments}
              categories={categories}
              onChange={setStaff}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={handleAddStaff}>
              <Plus className="w-4 h-4 mr-2" />
              직원 추가
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-gray-500">
                등록된 직원이 없습니다
              </div>
            ) : (
              staff.map((s, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg" onClick={() => handleEditClick(index)}>
                        {s.name || '이름 없음'}
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
                      <div>부서: {s.departmentName || '-'}</div>
                      {s.categoryName && <div>구분: {s.categoryName}</div>}
                      <div>직급: {s.position || '-'}</div>
                      <div>근무형태: {s.workType === 'WEEK_4' ? '주 4일' : '주 5일'}</div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
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
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex === -1 ? '직원 추가' : '직원 편집'}
            </DialogTitle>
            <DialogDescription>
              직원 정보를 입력하세요
            </DialogDescription>
          </DialogHeader>

          {editForm && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="staffName">이름</Label>
                <Input
                  id="staffName"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="직원 이름"
                />
              </div>

              <div>
                <Label htmlFor="birthDate">생년월일 (YYMMDD)</Label>
                <Input
                  id="birthDate"
                  value={editForm.birthDate}
                  onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                  placeholder="950101"
                  maxLength={6}
                />
              </div>

              <div>
                <Label htmlFor="department">부서 ({departments.length}개)</Label>
                <Select
                  value={editForm.departmentName || undefined}
                  onValueChange={(value) => setEditForm({ ...editForm, departmentName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="부서 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">등록된 부서가 없습니다</div>
                    ) : (
                      departments.map((dept) => (
                        <SelectItem key={dept.name} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">구분 ({categories.length}개)</Label>
                <Select
                  value={editForm.categoryName || 'NONE'}
                  onValueChange={(value) => setEditForm({ ...editForm, categoryName: value === 'NONE' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="구분 선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">없음</SelectItem>
                    {categories.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">등록된 구분이 없습니다</div>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.name} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="position">직급</Label>
                <Select
                  value={editForm.position || undefined}
                  onValueChange={(value) => setEditForm({ ...editForm, position: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="직급 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="사원">사원</SelectItem>
                    <SelectItem value="주임">주임</SelectItem>
                    <SelectItem value="대리">대리</SelectItem>
                    <SelectItem value="과장">과장</SelectItem>
                    <SelectItem value="차장">차장</SelectItem>
                    <SelectItem value="부장">부장</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="workType">근무형태</Label>
                <Select
                  value={editForm.workType || undefined}
                  onValueChange={(value: 'WEEK_4' | 'WEEK_5') => setEditForm({ ...editForm, workType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="근무형태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEK_4">주 4일</SelectItem>
                    <SelectItem value="WEEK_5">주 5일</SelectItem>
                  </SelectContent>
                </Select>
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
                setStaff([...staff, editForm])
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
