'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { UserPlus, Save } from 'lucide-react'
import type { Staff, StaffRank, WorkType } from './StaffList'

interface StaffFormProps {
  staff: Staff | null
  isOpen: boolean
  onClose: (saved: boolean) => void
}

const RANK_OPTIONS: { value: StaffRank; label: string }[] = [
  { value: 'HYGIENIST', label: '위생사' },
  { value: 'ASSISTANT', label: '어시스턴트' },
  { value: 'COORDINATOR', label: '코디네이터' },
  { value: 'NURSE', label: '간호조무사' },
  { value: 'OTHER', label: '기타' },
]

const WORK_TYPE_OPTIONS: { value: WorkType; label: string; description: string }[] = [
  { value: 'WEEK_5', label: '주5일 근무', description: '월~금 5일 근무' },
  { value: 'WEEK_4', label: '주4일 근무', description: '주 4일 근무 (파트타임)' },
]

export function StaffForm({ staff, isOpen, onClose }: StaffFormProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])

  const [formData, setFormData] = useState({
    name: '',
    rank: 'HYGIENIST' as StaffRank,
    workType: 'WEEK_5' as WorkType,
    departmentName: '',
    categoryName: '',
    totalAnnualDays: 15,
    flexibleForCategories: [] as string[],
    flexibilityPriority: 0,
    pin: '',
    phoneNumber: '',
    email: '',
    isActive: true,
  })

  // 부서 및 구분 목록 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // 부서 목록 로드
        const deptResponse = await fetch('/api/settings/departments')
        const deptResult = await deptResponse.json()
        if (deptResult.success && deptResult.departments) {
          setDepartments(deptResult.departments)
        }

        // 구분 목록 로드
        const catResponse = await fetch('/api/settings/staff-categories')
        const catResult = await catResponse.json()
        if (catResult.success && catResult.categories) {
          setCategories(catResult.categories.map((c: any) => c.name))
        }
      } catch (error) {
        console.error('부서/구분 로드 실패:', error)
      }
    }

    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name,
        rank: staff.rank,
        workType: staff.workType || 'WEEK_5',
        departmentName: (staff as any).departmentName || '',
        categoryName: (staff as any).categoryName || '',
        totalAnnualDays: (staff as any).totalAnnualDays || 15,
        flexibleForCategories: (staff as any).flexibleForCategories || [],
        flexibilityPriority: (staff as any).flexibilityPriority || 0,
        pin: '', // PIN은 수정 시 비워둠 (보안)
        phoneNumber: staff.phoneNumber || '',
        email: staff.email || '',
        isActive: staff.isActive,
      })
    } else {
      setFormData({
        name: '',
        rank: 'HYGIENIST',
        workType: 'WEEK_5',
        departmentName: '',
        categoryName: '',
        totalAnnualDays: 15,
        flexibleForCategories: [],
        flexibilityPriority: 0,
        pin: '',
        phoneNumber: '',
        email: '',
        isActive: true,
      })
    }
  }, [staff, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // 유효성 검사
      if (!formData.name.trim()) {
        throw new Error('이름을 입력해주세요.')
      }

      if (!staff && !formData.pin) {
        throw new Error('PIN을 입력해주세요.')
      }

      if (formData.pin && !/^\d{4}$/.test(formData.pin)) {
        throw new Error('PIN은 4자리 숫자여야 합니다.')
      }

      const url = staff ? `/api/staff/${staff.id}` : '/api/staff'
      const method = staff ? 'PATCH' : 'POST'

      const body: any = {
        name: formData.name,
        rank: formData.rank,
        workType: formData.workType,
        departmentName: formData.departmentName || null,
        categoryName: formData.categoryName || null,
        totalAnnualDays: formData.totalAnnualDays,
        flexibleForCategories: formData.flexibleForCategories,
        flexibilityPriority: formData.flexibilityPriority,
        phoneNumber: formData.phoneNumber || null,
        email: formData.email || null,
        isActive: formData.isActive,
      }

      // PIN은 새로 추가할 때만 필수, 수정 시는 선택
      if (!staff || formData.pin) {
        body.pin = formData.pin
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: staff ? '수정 완료' : '추가 완료',
          description: `${formData.name} 직원이 ${staff ? '수정' : '추가'}되었습니다.`,
        })
        onClose(true)
      } else {
        throw new Error(result.error || '저장 실패')
      }
    } catch (error: any) {
      toast({
        title: staff ? '수정 실패' : '추가 실패',
        description: error.message || '다시 시도해주세요.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {staff ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {staff ? '직원 정보 수정' : '새 직원 추가'}
          </DialogTitle>
          <DialogDescription>
            {staff
              ? '직원 정보를 수정합니다. PIN은 변경할 경우에만 입력하세요.'
              : '새로운 직원을 추가합니다. 모든 필수 정보를 입력해주세요.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* 이름 */}
            <div>
              <Label htmlFor="name">
                이름 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="예: 김민수"
                required
              />
            </div>

            {/* 직급 */}
            <div>
              <Label htmlFor="rank">
                직급 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.rank}
                onValueChange={(value) =>
                  setFormData({ ...formData, rank: value as StaffRank })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANK_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 근무 형태 */}
            <div>
              <Label htmlFor="workType">
                근무 형태 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.workType}
                onValueChange={(value) =>
                  setFormData({ ...formData, workType: value as WorkType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-gray-500">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                스케줄 자동 배치 시 주당 근무일수가 반영됩니다
              </p>
            </div>

            {/* 부서 */}
            <div>
              <Label htmlFor="departmentName">부서</Label>
              <Select
                value={formData.departmentName}
                onValueChange={(value) =>
                  setFormData({ ...formData, departmentName: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="부서 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                부서를 선택하면 자동 배치 시 해당 부서만 배치됩니다
              </p>
            </div>

            {/* 구분 */}
            <div>
              <Label htmlFor="categoryName">구분</Label>
              <Select
                value={formData.categoryName}
                onValueChange={(value) =>
                  setFormData({ ...formData, categoryName: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="구분 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                스케줄 배치 시 사용되는 직원 구분입니다
              </p>
            </div>

            {/* 연차 일수 */}
            <div>
              <Label htmlFor="totalAnnualDays">연차 총 일수</Label>
              <Input
                id="totalAnnualDays"
                type="number"
                min="0"
                max="30"
                value={formData.totalAnnualDays}
                onChange={(e) =>
                  setFormData({ ...formData, totalAnnualDays: parseInt(e.target.value) || 0 })
                }
                placeholder="15"
              />
              <p className="text-xs text-gray-500 mt-1">
                연차 신청 가능한 총 일수 (기본값: 15일)
              </p>
            </div>

            {/* 유연배치 - 다른 구분 */}
            <div>
              <Label>유연 배치 가능 구분 (선택사항)</Label>
              <div className="space-y-2 mt-2">
                {categories.map((cat) => (
                  <div key={cat} className="flex items-center space-x-2">
                    <Checkbox
                      id={`flex-${cat}`}
                      checked={formData.flexibleForCategories.includes(cat)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            flexibleForCategories: [...formData.flexibleForCategories, cat]
                          })
                        } else {
                          setFormData({
                            ...formData,
                            flexibleForCategories: formData.flexibleForCategories.filter(c => c !== cat)
                          })
                        }
                      }}
                    />
                    <Label htmlFor={`flex-${cat}`} className="cursor-pointer font-normal">
                      {cat}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                이 직원이 다른 구분으로도 배치 가능한 경우 선택하세요
              </p>
            </div>

            {/* 유연배치 우선순위 */}
            {formData.flexibleForCategories.length > 0 && (
              <div>
                <Label htmlFor="flexibilityPriority">유연 배치 우선순위</Label>
                <Input
                  id="flexibilityPriority"
                  type="number"
                  min="0"
                  max="10"
                  value={formData.flexibilityPriority}
                  onChange={(e) =>
                    setFormData({ ...formData, flexibilityPriority: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  숫자가 높을수록 우선적으로 유연 배치됩니다 (0-10)
                </p>
              </div>
            )}

            {/* PIN */}
            <div>
              <Label htmlFor="pin">
                PIN {!staff && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="pin"
                type="password"
                value={formData.pin}
                onChange={(e) =>
                  setFormData({ ...formData, pin: e.target.value })
                }
                placeholder="4자리 숫자"
                maxLength={4}
                required={!staff}
              />
              <p className="text-xs text-gray-500 mt-1">
                {staff
                  ? '변경할 경우에만 입력하세요 (4자리 숫자)'
                  : '연차 신청 시 사용할 4자리 숫자'}
              </p>
            </div>

            {/* 전화번호 */}
            <div>
              <Label htmlFor="phoneNumber">전화번호</Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                placeholder="예: 010-1234-5678"
              />
            </div>

            {/* 이메일 */}
            <div>
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="예: staff@example.com"
              />
            </div>

            {/* 활성 상태 */}
            {staff && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked as boolean })
                  }
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  활성 상태 (체크 해제 시 비활성화)
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '저장 중...' : staff ? '수정' : '추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
