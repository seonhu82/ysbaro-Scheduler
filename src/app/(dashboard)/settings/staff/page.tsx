'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Save, Edit2, Trash2, Plus, Calendar } from 'lucide-react'
import { StaffRegistrationStep } from '@/components/setup/StaffRegistrationStep'
import { calculateAnnualLeave, formatYearsOfService, getAnnualLeaveReason } from '@/lib/utils/annual-leave-calculator'

interface Staff {
  name: string
  birthDate: string
  hireDate: string | null
  departmentName: string
  categoryName: string
  position: string
  workType: 'WEEK_4' | 'WEEK_5'
  flexibleForCategories: string[]
  totalAnnualDays: number
  usedAnnualDays: number
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

interface Position {
  id: string
  name: string
}

export default function StaffSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [staff, setStaff] = useState<Staff[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Staff | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [defaultAnnualDays, setDefaultAnnualDays] = useState<number>(15)

  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [staffRes, deptRes, catRes, posRes] = await Promise.all([
          fetch('/api/staff?includeInactive=true'),
          fetch('/api/settings/departments'),
          fetch('/api/settings/categories'),
          fetch('/api/settings/positions')
        ])

        const [staffData, deptData, catData, posData] = await Promise.all([
          staffRes.json(),
          deptRes.json(),
          catRes.json(),
          posRes.json()
        ])

        if (staffData.success && staffData.data) {
          const formattedStaff: Staff[] = staffData.data.map((s: any) => ({
            name: s.name,
            birthDate: s.birthDateStr || s.birthDate?.toISOString().split('T')[0].replace(/-/g, '').slice(2) || '',
            hireDate: s.hireDate ? new Date(s.hireDate).toISOString().split('T')[0] : null,
            departmentName: s.departmentName || '',
            categoryName: s.categoryName || '',
            position: s.position || '사원',
            workType: s.workType || 'WEEK_4',
            flexibleForCategories: s.flexibleForCategories || [],
            totalAnnualDays: s.totalAnnualDays || 15,
            usedAnnualDays: s.usedAnnualDays || 0,
          }))
          setStaff(formattedStaff)
        }

        console.log('Raw deptData:', deptData)
        if (Array.isArray(deptData)) {
          setDepartments(deptData)
          console.log('Departments loaded (array):', deptData.length, deptData)
        } else if (deptData.success && deptData.data) {
          setDepartments(deptData.data)
          console.log('Departments loaded (object):', deptData.data)
        } else {
          console.error('Departments 로드 실패:', deptData)
        }

        console.log('Raw catData:', catData)
        if (Array.isArray(catData)) {
          // API는 department 객체를 반환하므로 departmentName 필드로 변환
          const formattedCategories = catData.map((cat: any) => ({
            name: cat.name,
            priority: cat.priority,
            order: cat.order,
            departmentName: cat.department?.name || null
          }))
          setCategories(formattedCategories)
          console.log('Categories loaded (array):', formattedCategories.length, formattedCategories)
        } else if (catData.success && catData.data) {
          const formattedCategories = catData.data.map((cat: any) => ({
            name: cat.name,
            priority: cat.priority,
            order: cat.order,
            departmentName: cat.department?.name || null
          }))
          setCategories(formattedCategories)
          console.log('Categories loaded (object):', formattedCategories)
        } else {
          console.error('Categories 로드 실패:', catData)
        }

        // Positions 로드
        if (Array.isArray(posData)) {
          setPositions(posData)
          console.log('Positions loaded:', posData.length, posData)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // 규칙 설정에서 기본 연차 일수 가져오기
  useEffect(() => {
    const fetchRuleSettings = async () => {
      try {
        const response = await fetch('/api/settings/rules')
        const data = await response.json()
        if (data.success && data.data) {
          setDefaultAnnualDays(data.data.defaultAnnualDays || 15)
        }
      } catch (error) {
        console.error('규칙 설정 로드 실패:', error)
        setDefaultAnnualDays(15)
      }
    }
    fetchRuleSettings()
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
    const staffData = { ...staff[index] }
    console.log('편집할 직원 데이터:', staffData)
    setEditForm(staffData)
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
      totalAnnualDays: 15,
      usedAnnualDays: 0
    })
  }

  // 직원 데이터에서 실제 사용 중인 부서 및 구분 추출
  const usedDepartments = Array.from(new Set(staff.map(s => s.departmentName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'))
  const usedCategories = Array.from(new Set(staff.map(s => s.categoryName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'))

  // 정렬 및 필터링
  const sortedAndFilteredStaff = staff
    .filter(s => {
      if (filterDepartment !== 'ALL' && s.departmentName !== filterDepartment) return false
      if (filterCategory !== 'ALL' && s.categoryName !== filterCategory) return false
      return true
    })
    .sort((a, b) => {
      // 1차: 부서명으로 정렬
      if (a.departmentName !== b.departmentName) {
        return (a.departmentName || '').localeCompare(b.departmentName || '', 'ko')
      }
      // 2차: 구분으로 정렬
      if (a.categoryName !== b.categoryName) {
        return (a.categoryName || '').localeCompare(b.categoryName || '', 'ko')
      }
      // 3차: 이름으로 정렬
      return (a.name || '').localeCompare(b.name || '', 'ko')
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-16 bg-white z-20 pb-4 -mx-6 px-6 pt-6 -mt-6 border-b shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">직원 관리</h1>
            <p className="text-gray-600 mt-2">직원 정보를 등록하고 관리합니다</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkEdit(!showBulkEdit)}>
              {showBulkEdit ? '목록 보기' : '일괄 편집'}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="min-w-[100px]">
              <Save className="w-4 h-4 mr-2" />
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </div>

      {showBulkEdit ? (
        <Card>
          <CardContent className="pt-6">
            <StaffRegistrationStep
              data={staff}
              departments={departments}
              categories={categories}
              positions={positions}
              onChange={setStaff}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 필터 및 추가 버튼 */}
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="filterDept" className="whitespace-nowrap">부서:</Label>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger id="filterDept" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 부서</SelectItem>
                    {usedDepartments.map(dept => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="filterCat" className="whitespace-nowrap">구분:</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger id="filterCat" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체 구분</SelectItem>
                    {usedCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-gray-600">
                총 {sortedAndFilteredStaff.length}명
              </div>
            </div>

            <Button onClick={handleAddStaff}>
              <Plus className="w-4 h-4 mr-2" />
              직원 추가
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedAndFilteredStaff.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-gray-500">
                {staff.length === 0 ? '등록된 직원이 없습니다' : '필터 조건에 맞는 직원이 없습니다'}
              </div>
            ) : (
              sortedAndFilteredStaff.map((s, displayIndex) => {
                // 원본 배열에서의 인덱스 찾기 (편집 시 필요)
                const originalIndex = staff.findIndex(
                  original => original.name === s.name && original.birthDate === s.birthDate
                )
                return (
                <Card key={displayIndex} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg" onClick={() => handleEditClick(originalIndex)}>
                        {s.name || '이름 없음'}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditClick(originalIndex)
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick(originalIndex)
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent onClick={() => handleEditClick(originalIndex)}>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div>부서: {s.departmentName || '-'}</div>
                      {s.categoryName && <div>구분: {s.categoryName}</div>}
                      <div>직급: {s.position || '-'}</div>
                      <div>근무형태: {s.workType === 'WEEK_4' ? '주 4일' : '주 5일'}</div>
                    </div>
                  </CardContent>
                </Card>
              )})
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
                <Label htmlFor="hireDate" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  입사일
                </Label>
                <Input
                  id="hireDate"
                  type="date"
                  value={editForm.hireDate || ''}
                  onChange={(e) => {
                    const newHireDate = e.target.value

                    // 입사일이 입력되면 자동으로 연차 계산, 비우면 기본값 사용
                    if (newHireDate) {
                      const calculatedAnnual = calculateAnnualLeave(new Date(newHireDate))
                      setEditForm(prev => ({
                        ...prev!,
                        hireDate: newHireDate,
                        totalAnnualDays: calculatedAnnual
                      }))
                    } else {
                      // 입사일이 비어있으면 기본 연차 사용
                      setEditForm(prev => ({
                        ...prev!,
                        hireDate: null,
                        totalAnnualDays: defaultAnnualDays
                      }))
                    }
                  }}
                />
                {editForm.hireDate && (
                  <p className="text-xs text-blue-600 mt-1">
                    {getAnnualLeaveReason(new Date(editForm.hireDate))}
                  </p>
                )}
                {!editForm.hireDate && (
                  <p className="text-xs text-gray-500 mt-1">
                    입사일을 입력하면 근속연수에 따라 연차가 자동 계산됩니다.
                    (미입력 시 기본 {defaultAnnualDays}일 적용)
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="department">부서</Label>
                <Select
                  value={editForm.departmentName || undefined}
                  onValueChange={(value) => setEditForm({ ...editForm, departmentName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="부서 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {usedDepartments.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">등록된 부서가 없습니다</div>
                    ) : (
                      usedDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">구분</Label>
                <Select
                  value={editForm.categoryName || 'NONE'}
                  onValueChange={(value) => setEditForm({ ...editForm, categoryName: value === 'NONE' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="구분 선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">없음</SelectItem>
                    {usedCategories.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">등록된 구분이 없습니다</div>
                    ) : (
                      usedCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="position">직급</Label>
                <Input
                  id="position"
                  list="position-list"
                  value={editForm.position || ''}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                  placeholder="직급 선택 또는 입력"
                />
                <datalist id="position-list">
                  {(positions || []).map((pos) => (
                    <option key={pos.id} value={pos.name} />
                  ))}
                </datalist>
                <p className="text-xs text-gray-500 mt-1">
                  목록에서 선택하거나 새 직급을 직접 입력할 수 있습니다.
                </p>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalAnnual">총 연차</Label>
                  <Input
                    id="totalAnnual"
                    type="number"
                    min="0"
                    max="30"
                    value={editForm.totalAnnualDays}
                    onChange={(e) => setEditForm({ ...editForm, totalAnnualDays: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="usedAnnual">사용 연차</Label>
                  <Input
                    id="usedAnnual"
                    type="number"
                    min="0"
                    max={editForm.totalAnnualDays}
                    value={editForm.usedAnnualDays}
                    onChange={(e) => setEditForm({ ...editForm, usedAnnualDays: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-md">
                <div className="text-sm font-medium text-blue-900">
                  남은 연차: {editForm.totalAnnualDays - editForm.usedAnnualDays}일
                </div>
              </div>

              {/* 유연배치 */}
              <div>
                <Label>유연배치 구분</Label>
                <p className="text-xs text-gray-500 mb-2">
                  자신의 본래 구분 외에 수행 가능한 구분을 선택하세요
                </p>
                <div className="space-y-2">
                  {(() => {
                    // 같은 부서의 구분만 표시 (자신의 구분 제외)
                    const availableCategories = categories.filter(cat => {
                      // 자신의 구분 제외
                      if (cat.name === editForm.categoryName) return false
                      // 부서가 없는 구분(공통)은 모든 부서에서 사용 가능
                      if (cat.departmentName === null) return true
                      // 같은 부서의 구분만
                      return cat.departmentName === editForm.departmentName
                    })

                    if (availableCategories.length === 0) {
                      return (
                        <div className="text-sm text-gray-400 italic">
                          유연배치 가능한 구분이 없습니다
                        </div>
                      )
                    }

                    return (
                      <div className="flex flex-wrap gap-2">
                        {availableCategories.map((cat) => {
                          const isSelected = (editForm.flexibleForCategories || []).includes(cat.name)
                          return (
                            <button
                              key={cat.name}
                              type="button"
                              onClick={() => {
                                const current = editForm.flexibleForCategories || []
                                const updated = isSelected
                                  ? current.filter(c => c !== cat.name)
                                  : [...current, cat.name]
                                setEditForm({ ...editForm, flexibleForCategories: updated })
                              }}
                              className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                                isSelected
                                  ? 'bg-orange-100 text-orange-700 border-orange-300 font-medium'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {cat.name}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
                {editForm.flexibleForCategories && editForm.flexibleForCategories.length > 0 && (
                  <div className="mt-2 p-2 bg-orange-50 rounded text-xs text-orange-700">
                    선택됨: {editForm.flexibleForCategories.join(', ')}
                  </div>
                )}
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
