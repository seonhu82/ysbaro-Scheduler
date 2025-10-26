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

export default function DepartmentsSettings() {
  const [activeTab, setActiveTab] = useState<'departments' | 'categories'>('departments')
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [deptRes, catRes] = await Promise.all([
        fetch('/api/settings/departments'),
        fetch('/api/settings/categories'),
      ])
      setDepartments(await deptRes.json())
      setCategories(await catRes.json())
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
  const [editPriority, setEditPriority] = useState(0)
  const [editDeptId, setEditDeptId] = useState<string | null>(null)

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/settings/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '새 구분',
          priority: 0,
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
          priority: editPriority,
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
          직원 구분을 관리합니다. 우선순위가 낮을수록 먼저 배치됩니다.
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
                <input
                  type="number"
                  value={editPriority}
                  onChange={(e) => setEditPriority(parseInt(e.target.value))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded"
                  placeholder="우선순위"
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
                    우선순위: {cat.priority} • 부서: {cat.department?.name || '없음'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingId(cat.id)
                    setEditName(cat.name)
                    setEditPriority(cat.priority)
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
