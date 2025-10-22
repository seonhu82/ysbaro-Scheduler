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
import type { Staff, StaffRank } from './StaffList'

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

export function StaffForm({ staff, isOpen, onClose }: StaffFormProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    rank: 'HYGIENIST' as StaffRank,
    pin: '',
    phoneNumber: '',
    email: '',
    isActive: true,
  })

  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name,
        rank: staff.rank,
        pin: '', // PIN은 수정 시 비워둠 (보안)
        phoneNumber: staff.phoneNumber || '',
        email: staff.email || '',
        isActive: staff.isActive,
      })
    } else {
      setFormData({
        name: '',
        rank: 'HYGIENIST',
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
