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
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { UserPlus, Save, Stethoscope } from 'lucide-react'
import type { Doctor } from './DoctorList'

interface DoctorFormProps {
  doctor: Doctor | null
  isOpen: boolean
  onClose: (saved: boolean) => void
}

export function DoctorForm({ doctor, isOpen, onClose }: DoctorFormProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    specialization: '',
    isActive: true,
  })

  useEffect(() => {
    if (doctor) {
      setFormData({
        name: doctor.name,
        specialization: doctor.specialization || '',
        isActive: doctor.isActive,
      })
    } else {
      setFormData({
        name: '',
        specialization: '',
        isActive: true,
      })
    }
  }, [doctor, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // 유효성 검사
      if (!formData.name.trim()) {
        throw new Error('이름을 입력해주세요.')
      }

      const url = doctor ? `/api/doctors/${doctor.id}` : '/api/doctors'
      const method = doctor ? 'PATCH' : 'POST'

      const body: any = {
        name: formData.name,
        specialization: formData.specialization || null,
        isActive: formData.isActive,
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: doctor ? '수정 완료' : '추가 완료',
          description: `${formData.name} 원장이 ${doctor ? '수정' : '추가'}되었습니다.`,
        })
        onClose(true)
      } else {
        throw new Error(result.error || '저장 실패')
      }
    } catch (error: any) {
      toast({
        title: doctor ? '수정 실패' : '추가 실패',
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
            {doctor ? (
              <Save className="w-5 h-5" />
            ) : (
              <UserPlus className="w-5 h-5" />
            )}
            {doctor ? '원장 정보 수정' : '새 원장 추가'}
          </DialogTitle>
          <DialogDescription>
            {doctor
              ? '원장 정보를 수정합니다.'
              : '새로운 원장을 추가합니다. 기본 근무 패턴이 자동으로 생성됩니다.'}
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
                placeholder="예: 김원장"
                required
              />
            </div>

            {/* 전문 분야 */}
            <div>
              <Label htmlFor="specialization">전문 분야</Label>
              <Input
                id="specialization"
                value={formData.specialization}
                onChange={(e) =>
                  setFormData({ ...formData, specialization: e.target.value })
                }
                placeholder="예: 치주과, 보철과, 임플란트 등"
              />
              <p className="text-xs text-gray-500 mt-1">
                선택사항입니다. 비워두면 표시되지 않습니다.
              </p>
            </div>

            {/* 활성 상태 */}
            {doctor && (
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

            {/* 안내 메시지 */}
            {!doctor && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium mb-1">기본 패턴 자동 생성</p>
                    <p className="text-xs text-blue-700">
                      월~금 주간, 토요일 주간+야간 패턴이 자동으로 생성됩니다.
                      <br />
                      패턴은 나중에 설정 메뉴에서 수정할 수 있습니다.
                    </p>
                  </div>
                </div>
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
              {submitting ? '저장 중...' : doctor ? '수정' : '추가'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
