'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Save, Plus, Edit2, Trash2, Copy } from 'lucide-react'
import { CombinationStep } from '@/components/setup/CombinationStep'

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

  // 템플릿 저장용 데이터
  const [newCombinations, setNewCombinations] = useState<any[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryRatios, setCategoryRatios] = useState<any>({})
  const [staff, setStaff] = useState<any[]>([])
  const [fairness, setFairness] = useState<any>({
    enableNightShiftFairness: false,
    enableWeekendFairness: false,
    enableHolidayFairness: false,
    enableHolidayAdjacentFairness: false
  })

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [combosRes, doctorsRes, deptsRes, catsRes, ratiosRes, staffRes] = await Promise.all([
        fetch('/api/settings/combinations'),
        fetch('/api/doctors'),
        fetch('/api/settings/departments'),
        fetch('/api/settings/categories'),
        fetch('/api/settings/category-ratios'),
        fetch('/api/staff')
      ])

      const [combosData, doctorsData, deptsData, catsData, ratiosData, staffData] = await Promise.all([
        combosRes.json(),
        doctorsRes.json(),
        deptsRes.json(),
        catsRes.json(),
        ratiosRes.json(),
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

      if (deptsData.success && deptsData.data) {
        setDepartments(deptsData.data)
      }

      if (catsData.success && catsData.data) {
        setCategories(catsData.data)
      }

      if (ratiosData.success && ratiosData.data) {
        setCategoryRatios(ratiosData.data.ratios || {})
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

      {/* 템플릿 추가 폼 */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{editingId ? '조합 수정' : '새 조합 템플릿 작성'}</CardTitle>
              <div className="flex gap-2">
                {editingId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingId(null)
                      setNewCombinations([])
                      setShowAddForm(false)
                    }}
                  >
                    취소
                  </Button>
                )}
                <Button
                  onClick={editingId ? handleUpdate : handleSaveTemplate}
                  disabled={saving || newCombinations.length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '저장 중...' : editingId ? '수정' : '저장'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CombinationStep
              data={newCombinations}
              doctors={doctors}
              departments={departments}
              staff={staff}
              fairness={fairness}
              categories={categories.map(c => c.name)}
              categoryRatios={categoryRatios}
              onChange={setNewCombinations}
              onFairnessChange={setFairness}
              onCategoryRatiosChange={setCategoryRatios}
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
 * 조합 카드 컴포넌트
 */
function CombinationCard({
  combination,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  combination: Combination
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const deptStaff = combination.departmentRequiredStaff || {}
  const catStaff = combination.departmentCategoryStaff || {}

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
              ? combination.doctors.join(', ')
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
