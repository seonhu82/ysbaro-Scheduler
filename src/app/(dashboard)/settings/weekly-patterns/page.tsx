'use client'

import { useState, useEffect } from 'react'

interface Combination {
  id: string
  name: string
  dayOfWeek: string
  doctors: string[]
  hasNightShift: boolean
}

interface WeeklyPatternDay {
  id?: string
  dayOfWeek: string
  combinationId: string | null
  combination?: Combination | null
  isClosedDay: boolean
}

interface WeeklyPattern {
  id: string
  name: string
  description: string | null
  isActive: boolean
  days: WeeklyPatternDay[]
}

const DAYS_OF_WEEK = [
  { key: 'MONDAY', label: '월요일' },
  { key: 'TUESDAY', label: '화요일' },
  { key: 'WEDNESDAY', label: '수요일' },
  { key: 'THURSDAY', label: '목요일' },
  { key: 'FRIDAY', label: '금요일' },
  { key: 'SATURDAY', label: '토요일' },
  { key: 'SUNDAY', label: '일요일' },
]

export default function WeeklyPatternsSettings() {
  const [patterns, setPatterns] = useState<WeeklyPattern[]>([])
  const [combinations, setCombinations] = useState<Combination[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPattern, setEditingPattern] = useState<WeeklyPattern | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [patternsRes, combinationsRes] = await Promise.all([
        fetch('/api/settings/weekly-patterns'),
        fetch('/api/settings/combinations'),
      ])
      const patternsData = await patternsRes.json()
      const combinationsData = await combinationsRes.json()

      // patternsData와 combinationsData 모두 { success: true, data: [...] } 형식
      setPatterns(patternsData.success ? patternsData.data : [])
      setCombinations(combinationsData.success ? combinationsData.data : [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/settings/weekly-patterns/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchData()
      } else {
        const error = await res.json()
        alert(`삭제 실패: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to delete pattern:', error)
    }
  }

  const handleToggleActive = async (pattern: WeeklyPattern) => {
    try {
      const res = await fetch(`/api/settings/weekly-patterns/${pattern.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pattern,
          isActive: !pattern.isActive,
        }),
      })
      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to toggle pattern:', error)
    }
  }

  const handleDuplicate = (pattern: WeeklyPattern) => {
    const newPattern: Partial<WeeklyPattern> = {
      name: `${pattern.name} (복사)`,
      description: pattern.description,
      days: pattern.days.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        combinationId: day.combinationId,
        isClosedDay: day.isClosedDay,
      })),
    }
    setEditingPattern(newPattern as WeeklyPattern)
    setShowCreateModal(true)
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">주간 패턴 관리</h1>
        <button
          onClick={() => {
            setEditingPattern(null)
            setShowCreateModal(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 새 패턴 만들기
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <p className="text-sm text-gray-600">
          주간 패턴은 7일간의 의사 조합을 그룹화하여 월별 스케줄 생성 시 재사용할
          수 있습니다. 기본 패턴은 자동으로 적용됩니다.
        </p>
      </div>

      {patterns.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">아직 주간 패턴이 없습니다.</p>
          <button
            onClick={() => {
              setEditingPattern(null)
              setShowCreateModal(true)
            }}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            첫 패턴 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              onEdit={() => {
                setEditingPattern(pattern)
                setShowCreateModal(true)
              }}
              onDelete={() => handleDelete(pattern.id)}
              onToggleActive={() => handleToggleActive(pattern)}
              onDuplicate={() => handleDuplicate(pattern)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <PatternModal
          pattern={editingPattern}
          combinations={combinations}
          onClose={() => {
            setShowCreateModal(false)
            setEditingPattern(null)
          }}
          onSave={() => {
            setShowCreateModal(false)
            setEditingPattern(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

/**
 * 패턴 카드 컴포넌트
 */
function PatternCard({
  pattern,
  onEdit,
  onDelete,
  onToggleActive,
  onDuplicate,
}: {
  pattern: WeeklyPattern
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  onDuplicate: () => void
}) {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-gray-900">{pattern.name}</h3>
              {!pattern.isActive && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  비활성
                </span>
              )}
            </div>
            {pattern.description && (
              <p className="text-sm text-gray-600 mt-1">{pattern.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {DAYS_OF_WEEK.map((day) => {
            const patternDay = pattern.days?.find((d) => d.dayOfWeek === day.key)
            return (
              <div
                key={day.key}
                className="border border-gray-200 rounded p-2 text-center"
              >
                <div className="text-xs font-medium text-gray-600 mb-1">
                  {day.label}
                </div>
                {patternDay?.isClosedDay ? (
                  <div className="text-xs text-red-600">휴무</div>
                ) : patternDay?.combination ? (
                  <div className="text-xs">
                    <div className="font-medium text-gray-900 truncate">
                      {patternDay.combination.name}
                    </div>
                    {patternDay.combination.hasNightShift && (
                      <div className="text-purple-600 mt-1">🌙</div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">미지정</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2 flex-wrap">
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          수정
        </button>
        <button
          onClick={onDuplicate}
          className="flex-1 px-3 py-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
        >
          복사
        </button>
        <button
          onClick={onToggleActive}
          className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          {pattern.isActive ? '비활성화' : '활성화'}
        </button>
        <button
          onClick={onDelete}
          className="flex-1 px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          삭제
        </button>
      </div>
    </div>
  )
}

/**
 * 패턴 생성/수정 모달
 */
function PatternModal({
  pattern,
  combinations,
  onClose,
  onSave,
}: {
  pattern: WeeklyPattern | null
  combinations: Combination[]
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(pattern?.name || '')
  const [description, setDescription] = useState(pattern?.description || '')
  const [days, setDays] = useState<WeeklyPatternDay[]>(
    pattern?.days ||
      DAYS_OF_WEEK.map((day) => ({
        dayOfWeek: day.key,
        combinationId: null,
        isClosedDay: false,
      }))
  )
  const [saving, setSaving] = useState(false)

  const handleDayChange = (
    dayOfWeek: string,
    field: 'combinationId' | 'isClosedDay',
    value: any
  ) => {
    setDays((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              [field]: value,
              ...(field === 'isClosedDay' && value ? { combinationId: null } : {}),
            }
          : day
      )
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('패턴 이름을 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const url = pattern?.id
        ? `/api/settings/weekly-patterns/${pattern.id}`
        : '/api/settings/weekly-patterns'
      const method = pattern?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          days,
        }),
      })

      if (res.ok) {
        onSave()
      } else {
        const error = await res.json()
        alert(`저장 실패: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to save pattern:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {pattern?.id ? '주간 패턴 수정' : '새 주간 패턴'}
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                패턴 이름 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="예: 일반 주간 패턴"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                설명
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                rows={2}
                placeholder="패턴에 대한 설명을 입력하세요"
              />
            </div>

          </div>

          {/* 요일별 조합 설정 */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">요일별 조합 설정</h3>
            {DAYS_OF_WEEK.map((dayInfo) => {
              const day = days.find((d) => d.dayOfWeek === dayInfo.key)
              if (!day) return null

              return (
                <div
                  key={dayInfo.key}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded"
                >
                  <div className="w-24 font-medium text-gray-700">
                    {dayInfo.label}
                  </div>
                  <div className="flex-1">
                    <select
                      value={day.combinationId || ''}
                      onChange={(e) =>
                        handleDayChange(
                          dayInfo.key,
                          'combinationId',
                          e.target.value || null
                        )
                      }
                      disabled={day.isClosedDay}
                      className="w-full px-3 py-2 border border-gray-300 rounded disabled:bg-gray-100"
                    >
                      <option value="">미지정</option>
                      {combinations
                        .filter((c) => c.dayOfWeek === dayInfo.key)
                        .map((combo) => (
                          <option key={combo.id} value={combo.id}>
                            {combo.name}
                            {combo.hasNightShift ? ' 🌙' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`closed-${dayInfo.key}`}
                      checked={day.isClosedDay}
                      onChange={(e) =>
                        handleDayChange(dayInfo.key, 'isClosedDay', e.target.checked)
                      }
                      className="mr-2"
                    />
                    <label
                      htmlFor={`closed-${dayInfo.key}`}
                      className="text-sm text-gray-600"
                    >
                      휴무일
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            disabled={saving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
