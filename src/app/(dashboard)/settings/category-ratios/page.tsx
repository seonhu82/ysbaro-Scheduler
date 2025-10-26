'use client'

import { useState, useEffect } from 'react'

interface Category {
  id: string
  name: string
  priority: number
}

export default function CategoryRatiosSettings() {
  const [categories, setCategories] = useState<Category[]>([])
  const [ratios, setRatios] = useState<{ [key: string]: number }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/category-ratios')
      const data = await res.json()
      setCategories(data.categories)
      setRatios(data.ratios)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRatioChange = (categoryId: string, value: number) => {
    setRatios({ ...ratios, [categoryId]: value })
  }

  const handleSave = async () => {
    const total = Object.values(ratios).reduce((sum, val) => sum + val, 0)
    if (total !== 100) {
      alert('비율 합계가 100%가 되어야 합니다.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/settings/category-ratios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratios }),
      })
      if (res.ok) {
        alert('저장되었습니다.')
      } else {
        const error = await res.json()
        alert(`저장 실패: ${error.error}`)
      }
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const total = Object.values(ratios).reduce((sum, val) => sum + val, 0)

  if (loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">구분별 비율 설정</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">배치 목표 비율</h2>
          <p className="text-sm text-gray-600">
            각 구분별 배치 목표 비율을 설정합니다. 자동 배치 시 이 비율을 최대한
            유지하도록 배치됩니다. 합계는 100%가 되어야 합니다.
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>구분이 없습니다.</p>
            <p className="text-sm mt-2">
              먼저 &quot;부서/구분 관리&quot;에서 구분을 추가해주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => (
              <div key={cat.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-medium text-gray-900">{cat.name}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      value={ratios[cat.id] || 0}
                      onChange={(e) =>
                        handleRatioChange(
                          cat.id,
                          Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                        )
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded text-center"
                    />
                    <span className="text-lg font-semibold text-blue-600">
                      {ratios[cat.id] || 0}%
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={ratios[cat.id] || 0}
                  onChange={(e) =>
                    handleRatioChange(cat.id, parseInt(e.target.value))
                  }
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                      ratios[cat.id] || 0
                    }%, #e5e7eb ${ratios[cat.id] || 0}%, #e5e7eb 100%)`,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {categories.length > 0 && (
          <>
            <div className="pt-6 border-t">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">합계</span>
                <span
                  className={`text-3xl font-bold ${
                    total === 100 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {total}%
                </span>
              </div>
              {total !== 100 && (
                <div className="mt-2 text-sm text-red-600">
                  ⚠️ 합계가 100%가 되어야 저장할 수 있습니다. (현재 {total > 100 ? '+' : ''}
                  {total - 100}%)
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  // 균등 분배
                  const equalRatio = Math.floor(100 / categories.length)
                  let remainder = 100 - equalRatio * categories.length
                  const newRatios: any = {}
                  categories.forEach((cat, index) => {
                    newRatios[cat.id] = equalRatio + (index === 0 ? remainder : 0)
                  })
                  setRatios(newRatios)
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                균등 분배
              </button>
              <button
                onClick={handleSave}
                disabled={saving || total !== 100}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 도움말 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">💡 비율 설정 가이드</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 비율은 5% 단위로 조정할 수 있습니다.</li>
          <li>
            • &quot;균등 분배&quot; 버튼을 누르면 모든 구분에 동일한 비율이 자동으로
            설정됩니다.
          </li>
          <li>
            • 실제 배치는 해당 구분의 직원 수와 가용성에 따라 조정될 수 있습니다.
          </li>
          <li>• 비율은 참고 목표이며, 강제 규칙이 아닙니다.</li>
        </ul>
      </div>
    </div>
  )
}
