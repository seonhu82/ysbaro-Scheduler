'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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

  useEffect(() => {
    fetchCombinations()
  }, [])

  const fetchCombinations = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/combinations')
      const data = await res.json()
      setCombinations(data)
    } catch (error) {
      console.error('Failed to fetch combinations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/settings/combinations/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchCombinations()
      }
    } catch (error) {
      console.error('Failed to delete combination:', error)
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
        fetchCombinations()
      }
    } catch (error) {
      console.error('Failed to duplicate combination:', error)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">의사 조합 관리</h1>
        <Link
          href="/setup?step=5"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + 새 조합 추가
        </Link>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <p className="text-sm text-gray-600">
          초기 설정에서 만든 의사 조합을 관리합니다. 조합을 수정하거나 복사할 수
          있습니다.
        </p>
      </div>

      {combinations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">아직 조합이 없습니다.</p>
          <Link
            href="/setup?step=5"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            첫 조합 만들기
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {combinations.map((combo) => (
            <CombinationCard
              key={combo.id}
              combination={combo}
              onDelete={() => handleDelete(combo.id)}
              onDuplicate={() => handleDuplicate(combo)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 조합 카드 컴포넌트
 */
function CombinationCard({
  combination,
  onDelete,
  onDuplicate,
}: {
  combination: Combination
  onDelete: () => void
  onDuplicate: () => void
}) {
  const deptStaff = combination.departmentRequiredStaff || {}
  const catStaff = combination.departmentCategoryStaff || {}

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900">{combination.name}</h3>
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
      </div>

      <div className="p-4 space-y-3">
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
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
        <button
          onClick={onDuplicate}
          className="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          복사
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
