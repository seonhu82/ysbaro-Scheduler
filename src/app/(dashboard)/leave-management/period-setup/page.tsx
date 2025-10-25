'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface LeavePeriod {
  id: string
  year: number
  month: number
  startDate: string
  endDate: string
  isActive: boolean
  createdAt: string
}

export default function PeriodSetupPage() {
  const [periods, setPeriods] = useState<LeavePeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [newPeriod, setNewPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    fetchPeriods()
  }, [])

  const fetchPeriods = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leave-management/period')
      const result = await response.json()

      if (result.success) {
        setPeriods(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch periods:', error)
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
      const response = await fetch('/api/leave-management/period', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPeriod)
      })

      if (response.ok) {
        setNewPeriod({
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          startDate: '',
          endDate: ''
        })
        fetchPeriods()
      }
    } catch (error) {
      console.error('Failed to create period:', error)
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/leave-management/period/${id}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (response.ok) {
        fetchPeriods()
      }
    } catch (error) {
      console.error('Failed to toggle period:', error)
    }
  }

  const handleDeletePeriod = async (id: string) => {
    if (!confirm('이 신청 기간을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/leave-management/period/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchPeriods()
      }
    } catch (error) {
      console.error('Failed to delete period:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">신청 기간 설정</h1>
        <p>로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">연차 신청 기간 설정</h1>

      {/* 신규 기간 생성 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>새 신청 기간 만들기</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">연도</label>
              <select
                value={newPeriod.year}
                onChange={(e) => setNewPeriod({ ...newPeriod, year: parseInt(e.target.value) })}
                className="w-full border rounded px-3 py-2"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">월</label>
              <select
                value={newPeriod.month}
                onChange={(e) => setNewPeriod({ ...newPeriod, month: parseInt(e.target.value) })}
                className="w-full border rounded px-3 py-2"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">시작일</label>
              <input
                type="date"
                value={newPeriod.startDate}
                onChange={(e) => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">종료일</label>
              <input
                type="date"
                value={newPeriod.endDate}
                onChange={(e) => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          <Button onClick={handleCreatePeriod} className="mt-4">
            기간 생성
          </Button>
        </CardContent>
      </Card>

      {/* 기존 기간 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>설정된 신청 기간</CardTitle>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <p className="text-gray-500 text-center py-8">설정된 신청 기간이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {periods.map((period) => (
                <div
                  key={period.id}
                  className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">
                        {period.year}년 {period.month}월
                      </span>
                      {period.isActive ? (
                        <Badge variant="default">활성</Badge>
                      ) : (
                        <Badge variant="secondary">비활성</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      신청 가능 기간: {period.startDate} ~ {period.endDate}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      생성일: {new Date(period.createdAt).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                      삭제
                    </Button>
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
