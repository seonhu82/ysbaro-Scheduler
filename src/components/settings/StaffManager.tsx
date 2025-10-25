'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, Edit, Trash2, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Staff {
  id: string
  name: string
  rank: string
  categoryName: string
  workType: string
  isActive: boolean
  totalAnnualDays: number
  usedAnnualDays: number
}

export function StaffManager() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    rank: 'HYGIENIST',
    categoryName: '',
    workType: 'WEEK_4',
    totalAnnualDays: 15
  })

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/staff')
      const result = await response.json()
      if (result.success) {
        setStaffList(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddStaff = async () => {
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setIsAddDialogOpen(false)
        setFormData({
          name: '',
          rank: 'HYGIENIST',
          categoryName: '',
          workType: 'WEEK_4',
          totalAnnualDays: 15
        })
        fetchStaff()
      }
    } catch (error) {
      console.error('Failed to add staff:', error)
    }
  }

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('이 직원을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/staff/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchStaff()
      }
    } catch (error) {
      console.error('Failed to delete staff:', error)
    }
  }

  const getRankLabel = (rank: string) => {
    const labels: Record<string, string> = {
      HYGIENIST: '위생사',
      ASSISTANT: '어시스턴트',
      COORDINATOR: '코디네이터',
      NURSE: '간호조무사'
    }
    return labels[rank] || rank
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            직원 관리
          </h2>
          <p className="text-gray-600 mt-1">직원 정보를 추가하고 관리합니다</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          직원 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전체 직원 ({staffList.length}명)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-gray-500">로딩 중...</p>
          ) : staffList.length === 0 ? (
            <p className="text-center py-8 text-gray-500">등록된 직원이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {staffList.map((staff) => (
                <div
                  key={staff.id}
                  className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-lg">{staff.name}</span>
                      <Badge variant="outline">{getRankLabel(staff.rank)}</Badge>
                      <Badge variant="secondary">{staff.categoryName}</Badge>
                      {!staff.isActive && (
                        <Badge variant="destructive">비활성</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>근무형태: {staff.workType === 'WEEK_4' ? '주4일' : '주5일'}</div>
                      <div>
                        연차: {staff.usedAnnualDays}/{staff.totalAnnualDays}일 사용
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingStaff(staff)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteStaff(staff.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 직원 추가 다이얼로그 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>직원 추가</DialogTitle>
            <DialogDescription>새로운 직원 정보를 입력하세요</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="직원 이름"
              />
            </div>

            <div>
              <Label htmlFor="rank">직급</Label>
              <select
                id="rank"
                value={formData.rank}
                onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="HYGIENIST">위생사</option>
                <option value="ASSISTANT">어시스턴트</option>
                <option value="COORDINATOR">코디네이터</option>
                <option value="NURSE">간호조무사</option>
              </select>
            </div>

            <div>
              <Label htmlFor="categoryName">구분</Label>
              <Input
                id="categoryName"
                value={formData.categoryName}
                onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                placeholder="예: A구분, B구분"
              />
            </div>

            <div>
              <Label htmlFor="workType">근무형태</Label>
              <select
                id="workType"
                value={formData.workType}
                onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="WEEK_4">주4일 근무</option>
                <option value="WEEK_5">주5일 근무</option>
              </select>
            </div>

            <div>
              <Label htmlFor="annualDays">연차 일수</Label>
              <Input
                id="annualDays"
                type="number"
                value={formData.totalAnnualDays}
                onChange={(e) =>
                  setFormData({ ...formData, totalAnnualDays: parseInt(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddStaff}>추가</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
