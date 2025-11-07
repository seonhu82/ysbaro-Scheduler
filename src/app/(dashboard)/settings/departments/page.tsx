'use client'

import { useState, useEffect } from 'react'

interface Department {
  id: string
  name: string
  useAutoAssignment: boolean
  order: number
}

interface Category {
  id: string
  name: string
  priority: number
  order: number
  departmentId: string | null
  department: {
    id: string
    name: string
  } | null
}

interface Position {
  id: string
  name: string
}

export default function DepartmentsSettings() {
  const [activeTab, setActiveTab] = useState<'departments' | 'categories' | 'positions'>('departments')
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [deptRes, catRes, posRes] = await Promise.all([
        fetch('/api/settings/departments'),
        fetch('/api/settings/categories'),
        fetch('/api/settings/positions'),
      ])

      const deptData = await deptRes.json()
      const catData = await catRes.json()
      const posData = await posRes.json()

      setDepartments(deptData)
      setCategories(catData)

      // Positions 처리 - 배열인지 확인
      console.log('Positions response:', posData)
      if (Array.isArray(posData)) {
        setPositions(posData)
      } else if (posData && typeof posData === 'object') {
        // 객체인 경우 data 속성이 있는지 확인
        console.log('Positions is object, keys:', Object.keys(posData))
        if (Array.isArray(posData.data)) {
          setPositions(posData.data)
        } else if (posData.success === false) {
          console.error('Positions API error:', posData.error)
          setPositions([])
        } else {
          console.error('Unexpected positions response structure:', posData)
          setPositions([])
        }
      } else {
        console.error('Positions response is not an array:', posData)
        setPositions([])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">부서/구분 관리</h1>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('departments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'departments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            부서 관리
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            구분 관리
          </button>
          <button
            onClick={() => setActiveTab('positions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'positions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            직급 관리
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : (
          <>
            {activeTab === 'departments' && (
              <DepartmentList
                departments={departments}
                onRefresh={fetchData}
              />
            )}
            {activeTab === 'categories' && (
              <CategoryList
                categories={categories}
                departments={departments}
                onRefresh={fetchData}
              />
            )}
            {activeTab === 'positions' && (
              <PositionList
                positions={positions}
                onRefresh={fetchData}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * 부서 목록 컴포넌트
 */
function DepartmentList({
  departments,
  onRefresh,
}: {
  departments: Department[]
  onRefresh: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUseAuto, setEditUseAuto] = useState(true)

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/settings/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '새 부서',
          useAutoAssignment: true,
        }),
      })
      if (res.ok) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to add department:', error)
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/departments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          useAutoAssignment: editUseAuto,
        }),
      })
      if (res.ok) {
        setEditingId(null)
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to update department:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/settings/departments/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to delete department:', error)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          부서를 관리합니다. 자동배치 사용 여부를 설정할 수 있습니다.
        </p>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + 부서 추가
        </button>
      </div>

      <div className="space-y-2">
        {departments.map((dept) => (
          <div
            key={dept.id}
            className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg"
          >
            {editingId === dept.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editUseAuto}
                    onChange={(e) => setEditUseAuto(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">자동배치</span>
                </label>
                <button
                  onClick={() => handleUpdate(dept.id)}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  저장
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="font-medium">{dept.name}</div>
                  <div className="text-xs text-gray-500">
                    {dept.useAutoAssignment ? '자동배치 사용' : '자동배치 미사용'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingId(dept.id)
                    setEditName(dept.name)
                    setEditUseAuto(dept.useAutoAssignment)
                  }}
                  className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(dept.id)}
                  className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                >
                  삭제
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 구분 목록 컴포넌트
 */
function CategoryList({
  categories,
  departments,
  onRefresh,
}: {
  categories: Category[]
  departments: Department[]
  onRefresh: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDeptId, setEditDeptId] = useState<string | null>(null)

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/settings/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '새 구분',
          departmentId: null,
        }),
      })
      if (res.ok) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to add category:', error)
    }
  }

  const handleUpdate = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          departmentId: editDeptId,
        }),
      })
      if (res.ok) {
        setEditingId(null)
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to update category:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/settings/categories/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          직원 구분을 관리합니다.
        </p>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + 구분 추가
        </button>
      </div>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg"
          >
            {editingId === cat.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded"
                  placeholder="구분명"
                />
                <select
                  value={editDeptId || ''}
                  onChange={(e) => setEditDeptId(e.target.value || null)}
                  className="w-40 px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">부서 없음</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleUpdate(cat.id)}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  저장
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="font-medium">{cat.name}</div>
                  <div className="text-xs text-gray-500">
                    부서: {cat.department?.name || '없음'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingId(cat.id)
                    setEditName(cat.name)
                    setEditDeptId(cat.departmentId)
                  }}
                  className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
                >
                  삭제
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}


/**
 * 직급 목록 컴포넌트
 */
function PositionList({
  positions,
  onRefresh,
}: {
  positions: Position[]
  onRefresh: () => void
}) {
  const [newPosition, setNewPosition] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!newPosition.trim()) {
      alert('직급명을 입력해주세요.')
      return
    }

    // 중복 확인
    if (positions.some(p => p.name === newPosition.trim())) {
      alert('이미 존재하는 직급입니다.')
      return
    }

    try {
      setAdding(true)
      const res = await fetch('/api/settings/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPosition.trim() }),
      })

      if (res.ok) {
        setNewPosition('')
        onRefresh()
      } else {
        const data = await res.json()
        alert(data.error || '직급 추가에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to add position:', error)
      alert('직급 추가 중 오류가 발생했습니다.')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm(`'${name}' 직급을 삭제하시겠습니까?`)) return

    try {
      const res = await fetch(`/api/settings/positions/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        onRefresh()
      } else {
        const data = await res.json()
        alert(data.error || '직급 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to delete position:', error)
      alert('직급 삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          현재 직원들이 사용 중인 직급 목록입니다. 직원 등록/수정 시 직급을 선택하거나 직접 입력할 수 있습니다.
        </p>
      </div>

      {/* 직급 추가 폼 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newPosition}
          onChange={(e) => setNewPosition(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="새 직급 입력 (예: 팀장, 실장, 사원)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={adding}
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
        >
          {adding ? '추가 중...' : '+ 추가'}
        </button>
      </div>

      {/* 직급 목록 */}
      {positions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">등록된 직급이 없습니다.</p>
          <p className="text-sm">위 입력창에서 직급을 추가하거나, 직원 등록 시 직급을 입력하면 자동으로 목록에 추가됩니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(positions || []).map((position) => (
            <div
              key={position.id}
              className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="font-medium text-gray-900">{position.name}</span>
              </div>
              <button
                onClick={() => handleDelete(position.name)}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 안내:</strong> 직급은 직원 관리에서 선택하거나 직접 입력할 수 있습니다.
          사용 중인 직급은 삭제할 수 없으며, 먼저 해당 직원들의 직급을 변경해야 합니다.
        </p>
      </div>
    </div>
  )
}

