'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Save, Plus, Edit2, Trash2, Copy, Settings2 } from 'lucide-react'
import { CombinationStep } from '@/components/setup/CombinationStep'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface Combination {
  id: string
  name: string
  dayOfWeek: string
  requiredStaff: number
  departmentRequiredStaff: any
  departmentCategoryStaff: any
  doctors: string[]
  hasNightShift: boolean
}

interface Doctor {
  name: string
  shortName: string
  useCategory: boolean
  categories: Array<{
    name: string
    shortName: string
  }>
}

interface Department {
  id: string
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

const DAY_NAMES: { [key: string]: string } = {
  MONDAY: '월요일',
  TUESDAY: '화요일',
  WEDNESDAY: '수요일',
  THURSDAY: '목요일',
  FRIDAY: '금요일',
  SATURDAY: '토요일',
  SUNDAY: '일요일',
}

export default function CombinationsSettings() {
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDeptSettings, setShowDeptSettings] = useState(false)

  // 템플릿 저장용 데이터
  const [newCombinations, setNewCombinations] = useState<any[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [staff, setStaff] = useState<any[]>([])

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [combosRes, doctorsRes, deptsRes, catsRes, staffRes] = await Promise.all([
        fetch('/api/settings/combinations'),
        fetch('/api/doctors'),
        fetch('/api/settings/departments'),
        fetch('/api/settings/categories'),
        fetch('/api/staff')
      ])

      const [combosData, doctorsData, deptsData, catsData, staffData] = await Promise.all([
        combosRes.json(),
        doctorsRes.json(),
        deptsRes.json(),
        catsRes.json(),
        staffRes.json()
      ])

      setCombinations(Array.isArray(combosData) ? combosData : (combosData?.data || []))

      if (doctorsData.success && doctorsData.data) {
        const formattedDoctors: Doctor[] = doctorsData.data.map((d: any) => ({
          name: d.name,
          shortName: d.shortName || '',
          useCategory: d.useCategory || false,
          categories: []
        }))
        setDoctors(formattedDoctors)
      }

      // 부서 API는 배열 직접 반환, 방어 코드로 두 형식 모두 처리
      if (Array.isArray(deptsData)) {
        setDepartments(deptsData)
      } else if (deptsData?.success && deptsData?.data) {
        setDepartments(deptsData.data)
      }

      if (catsData.success && catsData.data) {
        setCategories(catsData.data)
      }

      if (staffData.success && staffData.data) {
        setStaff(staffData.data)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (newCombinations.length === 0) {
      alert('저장할 조합이 없습니다.')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/settings/combinations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ combinations: newCombinations })
      })

      if (res.ok) {
        alert('저장되었습니다.')
        setNewCombinations([])
        setShowAddForm(false)
        fetchAllData()
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

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/settings/combinations/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchAllData()
      }
    } catch (error) {
      console.error('Failed to delete combination:', error)
    }
  }

  const handleEdit = (combination: Combination) => {
    setEditingId(combination.id)
    setNewCombinations([{
      name: combination.name,
      dayOfWeek: combination.dayOfWeek,
      requiredStaff: combination.requiredStaff,
      departmentRequiredStaff: combination.departmentRequiredStaff,
      departmentCategoryStaff: combination.departmentCategoryStaff,
      doctors: combination.doctors,
      hasNightShift: combination.hasNightShift
    }])
    setShowAddForm(true)
  }

  const handleUpdate = async () => {
    if (!editingId || newCombinations.length === 0) return

    try {
      setSaving(true)
      const res = await fetch(`/api/settings/combinations/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCombinations[0])
      })

      if (res.ok) {
        alert('수정되었습니다.')
        setNewCombinations([])
        setShowAddForm(false)
        setEditingId(null)
        fetchAllData()
      } else {
        const error = await res.json()
        alert(`수정 실패: ${error.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      console.error('Update error:', error)
      alert('수정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async (combination: Combination) => {
    try {
      const newCombo = {
        ...combination,
        name: `${combination.name} (복사)`,
      }
      delete (newCombo as any).id
      delete (newCombo as any).createdAt
      delete (newCombo as any).updatedAt

      const res = await fetch('/api/settings/combinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCombo),
      })
      if (res.ok) {
        fetchAllData()
      }
    } catch (error) {
      console.error('Failed to duplicate combination:', error)
    }
  }

  const handleDepartmentAutoAssignmentChange = async (deptId: string, useAutoAssignment: boolean) => {
    try {
      const res = await fetch(`/api/settings/departments/${deptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useAutoAssignment })
      })
      if (res.ok) {
        // 로컬 상태 업데이트
        setDepartments(prev =>
          prev.map(dept =>
            dept.id === deptId
              ? { ...dept, useAutoAssignment }
              : dept
          )
        )
      } else {
        alert('부서 설정 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to update department:', error)
      alert('부서 설정 업데이트 중 오류가 발생했습니다.')
    }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">의사 조합 관리</h1>
          <p className="text-gray-600 mt-2">요일별 의사 조합과 필요 인원을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDeptSettings(!showDeptSettings)}
          >
            <Settings2 className="w-4 h-4 mr-2" />
            부서 자동배치 설정
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                접기
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                새 조합 추가
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 부서 자동배치 빠른 설정 */}
      {showDeptSettings && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              부서 자동배치 설정
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              자동배치를 사용할 부서를 선택하세요. 자동배치 부서만 의사조합에서 필요 인원을 지정할 수 있습니다.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                >
                  <Label htmlFor={`dept-${dept.id}`} className="font-medium cursor-pointer flex-1">
                    {dept.name}
                  </Label>
                  <Switch
                    id={`dept-${dept.id}`}
                    checked={dept.useAutoAssignment}
                    onCheckedChange={(checked) =>
                      handleDepartmentAutoAssignmentChange(dept.id, checked)
                    }
                  />
                </div>
              ))}
            </div>
            {departments.filter(d => d.useAutoAssignment).length === 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-center">
                <p className="text-sm text-amber-900">
                  ⚠️ 자동배치를 사용하는 부서가 없습니다. 최소 1개 이상의 부서를 활성화하세요.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 수정 폼 */}
      {editingId && (
        <Card className="border-2 border-blue-500">
          <CardHeader className="bg-blue-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-blue-900">조합 수정</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(null)
                    setNewCombinations([])
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={saving || newCombinations.length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '저장 중...' : '수정 완료'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <EditCombinationForm
              combination={newCombinations[0]}
              doctors={doctors}
              departments={departments}
              staff={staff}
              categories={categories.map(c => c.name)}
              onChange={(updated) => setNewCombinations([updated])}
            />
          </CardContent>
        </Card>
      )}

      {/* 새 조합 추가 폼 */}
      {showAddForm && !editingId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>새 조합 템플릿 작성</CardTitle>
              <Button
                onClick={handleSaveTemplate}
                disabled={saving || newCombinations.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CombinationStep
              data={newCombinations}
              doctors={doctors}
              departments={departments}
              staff={staff}
              categories={categories.map(c => c.name)}
              onChange={setNewCombinations}
              editMode={false}
            />
          </CardContent>
        </Card>
      )}

      {/* 기존 조합 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>등록된 조합 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {combinations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">등록된 조합이 없습니다.</p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                첫 조합 만들기
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {combinations.map((combo) => (
                <CombinationCard
                  key={combo.id}
                  combination={combo}
                  doctors={doctors}
                  onEdit={() => handleEdit(combo)}
                  onDelete={() => handleDelete(combo.id)}
                  onDuplicate={() => handleDuplicate(combo)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 조합 수정 폼 컴포넌트
 */
function EditCombinationForm({
  combination,
  doctors,
  departments,
  staff,
  categories,
  onChange,
}: {
  combination: any
  doctors: Doctor[]
  departments: Department[]
  staff: any[]
  categories: string[]
  onChange: (combination: any) => void
}) {
  const [localCombination, setLocalCombination] = useState(combination)

  useEffect(() => {
    setLocalCombination(combination)
  }, [combination])

  useEffect(() => {
    onChange(localCombination)
  }, [localCombination])

  const doctorOptions = doctors.flatMap((doctor) => {
    if (doctor.useCategory && doctor.categories.length > 0) {
      return doctor.categories.map((category: any) => ({
        displayName: `${doctor.name}(${category.name})`,
        shortName: `${doctor.shortName}(${category.shortName || category.name})`
      }))
    } else {
      return [{
        displayName: doctor.name,
        shortName: doctor.shortName
      }]
    }
  })

  const toggleDoctor = (shortName: string) => {
    const isSelected = localCombination.doctors.includes(shortName)
    const updatedDoctors = isSelected
      ? localCombination.doctors.filter((d: string) => d !== shortName)
      : [...localCombination.doctors, shortName]

    setLocalCombination({
      ...localCombination,
      doctors: updatedDoctors,
      name: updatedDoctors.join('')
    })
  }

  const autoDepartments = departments.filter(d => d.useAutoAssignment)

  return (
    <div className="space-y-6">
      {/* 기본 정보 */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-lg">기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 조합명 */}
          <div>
            <Label>조합명</Label>
            <Input
              value={localCombination.name}
              onChange={(e) => setLocalCombination({ ...localCombination, name: e.target.value })}
              className="mt-1"
            />
          </div>

          {/* 요일 */}
          <div>
            <Label>요일</Label>
            <select
              value={localCombination.dayOfWeek}
              onChange={(e) => setLocalCombination({ ...localCombination, dayOfWeek: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="MONDAY">월요일</option>
              <option value="TUESDAY">화요일</option>
              <option value="WEDNESDAY">수요일</option>
              <option value="THURSDAY">목요일</option>
              <option value="FRIDAY">금요일</option>
              <option value="SATURDAY">토요일</option>
              <option value="SUNDAY">일요일</option>
            </select>
          </div>

          {/* 야간 진료 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hasNightShift"
              checked={localCombination.hasNightShift}
              onChange={(e) => setLocalCombination({ ...localCombination, hasNightShift: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="hasNightShift" className="cursor-pointer">야간 진료 포함</Label>
          </div>
        </CardContent>
      </Card>

      {/* 원장 선택 */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-lg">원장 구성</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {doctorOptions.map((option: any, index: number) => {
              const isSelected = localCombination.doctors.includes(option.shortName)
              return (
                <Button
                  key={index}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDoctor(option.shortName)}
                  className={`h-auto py-2 px-3 justify-start text-left ${
                    isSelected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'hover:bg-gray-100'
                  }`}
                >
                  <span className="truncate">{option.displayName}</span>
                </Button>
              )
            })}
          </div>
          {localCombination.doctors.length > 0 && (
            <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-900">
              선택됨: {localCombination.doctors.join(', ')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 부서별 필요 인원 */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-lg">부서별 필요 인원</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {autoDepartments.map((dept) => (
              <div key={dept.id} className="flex items-center gap-3 p-3 bg-white rounded border">
                <Label className="w-32">{dept.name}</Label>
                <Input
                  type="number"
                  min={0}
                  value={localCombination.departmentRequiredStaff?.[dept.name] || 0}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0
                    setLocalCombination({
                      ...localCombination,
                      departmentRequiredStaff: {
                        ...localCombination.departmentRequiredStaff,
                        [dept.name]: value
                      },
                      requiredStaff: Object.values({
                        ...localCombination.departmentRequiredStaff,
                        [dept.name]: value
                      }).reduce((sum: number, val: any) => sum + val, 0)
                    })
                  }}
                  className="w-24"
                />
                <span className="text-sm text-gray-600">명</span>
              </div>
            ))}
          </div>
          {autoDepartments.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded">
              자동배치 부서가 없습니다. 상단의 "부서 자동배치 설정"에서 설정하세요.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 구분별 상세 인원 */}
      {Object.entries(localCombination.departmentRequiredStaff || {}).some(([dept, count]: any) =>
        autoDepartments.find(d => d.name === dept) && count > 0
      ) && (
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="text-lg">구분별 상세 인원</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {autoDepartments
              .filter(dept => (localCombination.departmentRequiredStaff?.[dept.name] || 0) > 0)
              .map(dept => {
                const deptRequired = localCombination.departmentRequiredStaff[dept.name]
                const deptStaff = staff.filter((s: any) => s.departmentName === dept.name && s.categoryName)
                const deptCategories = Array.from(new Set(deptStaff.map((s: any) => s.categoryName)))

                if (deptCategories.length === 0) {
                  return (
                    <div key={dept.name} className="p-3 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-sm text-amber-900">
                        ⚠️ {dept.name} 부서에 구분이 설정된 직원이 없습니다.
                      </p>
                    </div>
                  )
                }

                const currentStaff = localCombination.departmentCategoryStaff?.[dept.name] || {}

                return (
                  <div key={dept.name} className="p-4 bg-white border rounded-lg">
                    <h4 className="font-semibold mb-3">{dept.name} (총 {deptRequired}명)</h4>
                    <div className="space-y-2">
                      {deptCategories.map((cat: any) => {
                        const config = currentStaff[cat] || { count: 0, minRequired: 0 }
                        return (
                          <div key={cat} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                            <Label className="w-24">{cat}</Label>
                            <Input
                              type="number"
                              min={0}
                              max={deptRequired}
                              value={config.count}
                              onChange={(e) => {
                                const value = Math.min(deptRequired, Math.max(0, parseInt(e.target.value) || 0))
                                setLocalCombination({
                                  ...localCombination,
                                  departmentCategoryStaff: {
                                    ...localCombination.departmentCategoryStaff,
                                    [dept.name]: {
                                      ...currentStaff,
                                      [cat]: {
                                        count: value,
                                        minRequired: Math.min(config.minRequired, value)
                                      }
                                    }
                                  }
                                })
                              }}
                              className="w-20"
                            />
                            <span className="text-sm">명</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`min-${dept.name}-${cat}`}
                                checked={config.minRequired > 0}
                                onChange={(e) => {
                                  setLocalCombination({
                                    ...localCombination,
                                    departmentCategoryStaff: {
                                      ...localCombination.departmentCategoryStaff,
                                      [dept.name]: {
                                        ...currentStaff,
                                        [cat]: {
                                          ...config,
                                          minRequired: e.target.checked ? config.count : 0
                                        }
                                      }
                                    }
                                  })
                                }}
                                className="rounded"
                              />
                              <Label htmlFor={`min-${dept.name}-${cat}`} className="text-sm cursor-pointer">
                                필수
                              </Label>
                            </div>
                            {config.minRequired > 0 && (
                              <>
                                <Input
                                  type="number"
                                  min={0}
                                  max={config.count}
                                  value={config.minRequired}
                                  onChange={(e) => {
                                    const value = Math.min(config.count, Math.max(0, parseInt(e.target.value) || 0))
                                    setLocalCombination({
                                      ...localCombination,
                                      departmentCategoryStaff: {
                                        ...localCombination.departmentCategoryStaff,
                                        [dept.name]: {
                                          ...currentStaff,
                                          [cat]: {
                                            ...config,
                                            minRequired: value
                                          }
                                        }
                                      }
                                    })
                                  }}
                                  className="w-20"
                                />
                                <div className="px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                                  유연: {config.count - config.minRequired}명
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * 조합 카드 컴포넌트
 */
function CombinationCard({
  combination,
  doctors,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  combination: Combination
  doctors: Doctor[]
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const deptStaff = combination.departmentRequiredStaff || {}
  const catStaff = combination.departmentCategoryStaff || {}

  // shortName을 전체 이름으로 변환
  const getDoctorFullNames = (shortNames: string[]) => {
    return shortNames.map(shortName => {
      const doctor = doctors.find(d => d.shortName === shortName || d.name === shortName)
      return doctor?.name || shortName
    })
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 bg-gray-50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{combination.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600">
                {DAY_NAMES[combination.dayOfWeek] || combination.dayOfWeek}
              </span>
              {combination.hasNightShift && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                  야간
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-4">
        {/* 원장 */}
        <div>
          <div className="text-xs text-gray-500 mb-1">원장</div>
          <div className="text-sm">
            {combination.doctors.length > 0
              ? getDoctorFullNames(combination.doctors).join(', ')
              : '없음'}
          </div>
        </div>

        {/* 부서별 필요 인원 */}
        {Object.keys(deptStaff).length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">부서별 필요 인원</div>
            <div className="text-sm space-y-1">
              {Object.entries(deptStaff).map(([dept, count]: any) => (
                <div key={dept} className="flex justify-between">
                  <span>{dept}</span>
                  <span className="font-medium">{count}명</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 구분별 상세 */}
        {Object.keys(catStaff).length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">구분별 상세 인원</div>
            <div className="text-xs space-y-1">
              {Object.entries(catStaff).map(([dept, cats]: any) => (
                <div key={dept}>
                  <div className="font-medium text-gray-700">{dept}:</div>
                  {Object.entries(cats).map(([cat, info]: any) => (
                    <div key={cat} className="ml-2 flex justify-between">
                      <span>{cat}</span>
                      <span>
                        {info.count}명
                        {info.minRequired > 0 && (
                          <span className="text-green-600">
                            {' '}
                            (필수 {info.minRequired})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1"
          >
            <Edit2 className="w-3 h-3 mr-1" />
            수정
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            className="flex-1"
          >
            <Copy className="w-3 h-3 mr-1" />
            복사
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="flex-1 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            삭제
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
