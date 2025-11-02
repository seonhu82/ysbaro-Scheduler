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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Calendar, Plus, X } from 'lucide-react'

interface Staff {
  id: string
  name: string
  rank: string
  categoryName?: string
  departmentName?: string
}

interface AdminLeaveDialogProps {
  open: boolean
  onClose: (created: boolean) => void
  selectedDate: Date | null
}

export function AdminLeaveDialog({ open, onClose, selectedDate }: AdminLeaveDialogProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  const [leaveType, setLeaveType] = useState<'ANNUAL' | 'OFF'>('ANNUAL')

  // 직원 목록 불러오기
  useEffect(() => {
    if (open) {
      fetchStaffList()
    }
  }, [open])

  const fetchStaffList = async () => {
    try {
      setLoadingStaff(true)
      const response = await fetch('/api/settings/staff?isActive=true&autoAssignOnly=true')
      const result = await response.json()

      console.log('Staff API response:', result)
      console.log('Staff count:', result.data?.length)

      if (result.success) {
        setStaffList(result.data || [])
      } else {
        console.error('API returned error:', result.error)
        toast({
          variant: 'destructive',
          title: 'API 오류',
          description: result.error || '직원 목록을 불러올 수 없습니다.',
        })
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error)
      toast({
        variant: 'destructive',
        title: '직원 목록 로드 실패',
        description: '직원 목록을 불러오는데 실패했습니다.',
      })
    } finally {
      setLoadingStaff(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedStaff || !selectedDate) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '직원과 날짜를 선택해주세요.',
      })
      return
    }

    setSubmitting(true)

    try {
      // 로컬 타임존을 유지하면서 YYYY-MM-DD 형식으로 변환
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      const dateString = `${year}-${month}-${day}`

      const response = await fetch('/api/leave-management/admin-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaff,
          date: dateString,
          leaveType,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '등록 완료',
          description: `${leaveType === 'ANNUAL' ? '연차' : '오프'}가 등록되었습니다.`,
        })
        onClose(true)
        // 폼 초기화
        setSelectedStaff('')
        setLeaveType('ANNUAL')
      } else {
        throw new Error(result.error || '등록 실패')
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '등록 실패',
        description: error.message || '다시 시도해주세요.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setSelectedStaff('')
    setLeaveType('ANNUAL')
    onClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            연차/오프 수동 등록
          </DialogTitle>
          <DialogDescription>
            관리자가 직접 직원의 연차 또는 오프를 등록합니다.
            {selectedDate && (
              <div className="mt-2 text-blue-600 font-medium">
                📅 {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월{' '}
                {selectedDate.getDate()}일
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* 직원 선택 */}
            <div>
              <Label htmlFor="staff">
                직원 선택 <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger id="staff">
                  <SelectValue placeholder="직원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {loadingStaff ? (
                    <div className="p-2 text-sm text-gray-500">로딩 중...</div>
                  ) : staffList.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">직원이 없습니다</div>
                  ) : (
                    staffList.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name} ({staff.categoryName || staff.rank})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* 타입 선택 */}
            <div>
              <Label htmlFor="leaveType">
                타입 <span className="text-red-500">*</span>
              </Label>
              <Select value={leaveType} onValueChange={(v) => setLeaveType(v as 'ANNUAL' | 'OFF')}>
                <SelectTrigger id="leaveType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANNUAL">연차</SelectItem>
                  <SelectItem value="OFF">오프</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 안내 */}
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-900">
                <strong>주의:</strong> 관리자가 직접 등록한 연차/오프는 자동으로 승인(CONFIRMED) 상태로 생성되며,
                신청 슬롯에서 제외됩니다.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              <X className="w-4 h-4 mr-1" />
              취소
            </Button>
            <Button type="submit" disabled={submitting || !selectedStaff}>
              <Plus className="w-4 h-4 mr-1" />
              {submitting ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
