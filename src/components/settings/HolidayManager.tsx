'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Plus, Trash2, CalendarDays } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Holiday {
  id: string
  name: string
  date: Date
  isRecurring: boolean
  createdAt: Date
}

export function HolidayManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    isRecurring: false
  })

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/holidays')
      const result = await response.json()
      if (result.success) {
        setHolidays(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddHoliday = async () => {
    if (!formData.name || !formData.date) {
      alert('휴업일 이름과 날짜를 입력하세요')
      return
    }

    try {
      const response = await fetch('/api/settings/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setIsAddDialogOpen(false)
        setFormData({ name: '', date: '', isRecurring: false })
        fetchHolidays()
      }
    } catch (error) {
      console.error('Failed to add holiday:', error)
      alert('휴업일 추가에 실패했습니다')
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('이 휴업일을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/settings/holidays/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchHolidays()
      }
    } catch (error) {
      console.error('Failed to delete holiday:', error)
      alert('휴업일 삭제에 실패했습니다')
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="w-6 h-6" />
            휴업일 관리
          </h2>
          <p className="text-gray-600 mt-1">공휴일 및 병원 휴업일을 관리합니다</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          휴업일 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전체 휴업일 ({holidays.length}개)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-gray-500">로딩 중...</p>
          ) : holidays.length === 0 ? (
            <p className="text-center py-8 text-gray-500">등록된 휴업일이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {holidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{holiday.name}</span>
                        {holiday.isRecurring && (
                          <Badge variant="secondary">매년 반복</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatDate(holiday.date)}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteHoliday(holiday.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 휴업일 추가 다이얼로그 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>휴업일 추가</DialogTitle>
            <DialogDescription>새로운 휴업일 정보를 입력하세요</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">휴업일 이름</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 신정, 설날"
              />
            </div>

            <div>
              <Label htmlFor="date">날짜</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isRecurring"
                checked={formData.isRecurring}
                onChange={(e) =>
                  setFormData({ ...formData, isRecurring: e.target.checked })
                }
                className="w-4 h-4"
              />
              <Label htmlFor="isRecurring" className="cursor-pointer">
                매년 반복 (같은 날짜에 자동으로 적용)
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddHoliday}>추가</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
