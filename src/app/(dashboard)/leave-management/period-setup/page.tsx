'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Calendar, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LeavePeriod {
  id: string
  year: number
  month: number
  startDate: string
  endDate: string
  maxSlots: number
  categorySlots: any
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface CategorySlot {
  category: string
  slots: number
}

export default function PeriodSetupPage() {
  const [periods, setPeriods] = useState<LeavePeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 신규 기간 생성 폼
  const [newPeriod, setNewPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    startDate: '',
    endDate: '',
    maxSlots: 0,
    categorySlots: [] as CategorySlot[]
  })

  // 구분별 슬롯 추가용
  const [newCategory, setNewCategory] = useState({ category: '', slots: 0 })

  useEffect(() => {
    fetchPeriods()
  }, [])

  const fetchPeriods = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/leave-management/period')
      const result = await response.json()

      if (result.success) {
        setPeriods(result.data || [])
      } else {
        setError(result.error || 'Failed to fetch periods')
      }
    } catch (error) {
      console.error('Failed to fetch periods:', error)
      setError('Failed to load periods')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePeriod = async () => {
    if (!newPeriod.startDate || !newPeriod.endDate) {
      alert('시작일과 종료일을 입력해주세요.')
      return
    }

    try {
      setError(null)
      const categorySlots = newPeriod.categorySlots.length > 0
        ? Object.fromEntries(
            newPeriod.categorySlots.map(cs => [cs.category, cs.slots])
          )
        : null

      const response = await fetch('/api/leave-management/period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPeriod,
          categorySlots
        })
      })

      const result = await response.json()

      if (result.success) {
        // 폼 초기화
        setNewPeriod({
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          startDate: '',
          endDate: '',
          maxSlots: 0,
          categorySlots: []
        })
        setNewCategory({ category: '', slots: 0 })
        fetchPeriods()
      } else {
        setError(result.error || 'Failed to create period')
      }
    } catch (error) {
      console.error('Failed to create period:', error)
      setError('Failed to create period')
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setError(null)
      const response = await fetch(`/api/leave-management/period/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      const result = await response.json()

      if (result.success) {
        fetchPeriods()
      } else {
        setError(result.error || 'Failed to update period')
      }
    } catch (error) {
      console.error('Failed to toggle period:', error)
      setError('Failed to update period')
    }
  }

  const handleDeletePeriod = async (id: string) => {
    if (!confirm('이 신청 기간을 삭제하시겠습니까?')) return

    try {
      setError(null)
      const response = await fetch(`/api/leave-management/period/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        fetchPeriods()
      } else {
        setError(result.error || 'Failed to delete period')
      }
    } catch (error) {
      console.error('Failed to delete period:', error)
      setError('Failed to delete period')
    }
  }

  const addCategorySlot = () => {
    if (!newCategory.category || newCategory.slots <= 0) {
      alert('구분명과 슬롯 수를 입력해주세요.')
      return
    }

    setNewPeriod({
      ...newPeriod,
      categorySlots: [...newPeriod.categorySlots, { ...newCategory }]
    })
    setNewCategory({ category: '', slots: 0 })
  }

  const removeCategorySlot = (index: number) => {
    setNewPeriod({
      ...newPeriod,
      categorySlots: newPeriod.categorySlots.filter((_, i) => i !== index)
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">신청 기간 설정</h1>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">연차/오프 신청 기간 설정</h1>
        <p className="text-gray-600">
          직원들이 연차 및 오프를 신청할 수 있는 기간을 월별로 설정합니다.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 신규 기간 생성 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            새 신청 기간 만들기
          </CardTitle>
          <CardDescription>
            연도와 월을 선택하고 신청 가능 기간을 설정하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 연도 및 월 선택 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="year">연도</Label>
              <select
                id="year"
                value={newPeriod.year}
                onChange={(e) => setNewPeriod({ ...newPeriod, year: parseInt(e.target.value) })}
                className="w-full mt-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="month">월</Label>
              <select
                id="month"
                value={newPeriod.month}
                onChange={(e) => setNewPeriod({ ...newPeriod, month: parseInt(e.target.value) })}
                className="w-full mt-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 신청 가능 기간 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">신청 시작일</Label>
              <Input
                id="startDate"
                type="date"
                value={newPeriod.startDate}
                onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate">신청 종료일</Label>
              <Input
                id="endDate"
                type="date"
                value={newPeriod.endDate}
                onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          {/* 최대 슬롯 수 */}
          <div>
            <Label htmlFor="maxSlots">최대 슬롯 수 (0 = 무제한)</Label>
            <Input
              id="maxSlots"
              type="number"
              min="0"
              value={newPeriod.maxSlots}
              onChange={(e) => setNewPeriod({ ...newPeriod, maxSlots: parseInt(e.target.value) || 0 })}
              className="mt-1"
              placeholder="0이면 무제한"
            />
            <p className="text-sm text-gray-500 mt-1">
              전체 최대 슬롯 수를 설정합니다. 0으로 설정하면 무제한입니다.
            </p>
          </div>

          {/* 구분별 슬롯 설정 */}
          <div>
            <Label>구분별 슬롯 설정 (선택사항)</Label>
            <div className="mt-2 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="구분 (예: 팀장, 고년차)"
                  value={newCategory.category}
                  onChange={(e) => setNewCategory({ ...newCategory, category: e.target.value })}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="1"
                  placeholder="슬롯 수"
                  value={newCategory.slots || ''}
                  onChange={(e) => setNewCategory({ ...newCategory, slots: parseInt(e.target.value) || 0 })}
                  className="w-32"
                />
                <Button onClick={addCategorySlot} variant="outline" size="sm">
                  추가
                </Button>
              </div>

              {newPeriod.categorySlots.length > 0 && (
                <div className="border rounded-md p-3 space-y-2">
                  {newPeriod.categorySlots.map((cs, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                      <span className="font-medium">{cs.category}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">{cs.slots}명</span>
                        <Button
                          onClick={() => removeCategorySlot(index)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleCreatePeriod} className="w-full" size="lg">
            <Plus className="h-4 w-4 mr-2" />
            신청 기간 생성
          </Button>
        </CardContent>
      </Card>

      {/* 기존 기간 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            설정된 신청 기간
          </CardTitle>
          <CardDescription>
            생성된 신청 기간을 관리하고 활성/비활성 상태를 변경할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">설정된 신청 기간이 없습니다</p>
              <p className="text-sm">위 폼을 사용하여 새 신청 기간을 생성하세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {periods.map((period) => (
                <div
                  key={period.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-semibold">
                          {period.year}년 {period.month}월
                        </span>
                        {period.isActive ? (
                          <Badge className="bg-green-500 hover:bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            활성
                          </Badge>
                        ) : (
                          <Badge variant="secondary">비활성</Badge>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            신청 기간: {formatDate(period.startDate)} ~ {formatDate(period.endDate)}
                          </span>
                        </div>
                        <div>
                          최대 슬롯: {period.maxSlots === 0 ? '무제한' : `${period.maxSlots}명`}
                        </div>
                        {period.categorySlots && Object.keys(period.categorySlots).length > 0 && (
                          <div>
                            구분별 슬롯:{' '}
                            {Object.entries(period.categorySlots as Record<string, number>).map(([cat, slots], idx) => (
                              <span key={cat}>
                                {idx > 0 && ', '}
                                {cat} {String(slots)}명
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 mt-2">
                        생성일: {new Date(period.createdAt).toLocaleString('ko-KR')}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant={period.isActive ? 'outline' : 'default'}
                        onClick={() => handleToggleActive(period.id, period.isActive)}
                      >
                        {period.isActive ? '비활성화' : '활성화'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeletePeriod(period.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
