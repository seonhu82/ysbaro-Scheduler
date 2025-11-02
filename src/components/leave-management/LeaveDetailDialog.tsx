'use client'

import { useState } from 'react'
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
import { Edit, Trash2, X, Save } from 'lucide-react'

interface LeaveApplication {
  id: string
  date: string
  leaveType: 'ANNUAL' | 'OFF'
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED'
  staff: {
    id: string
    name: string
    rank: string
  }
}

interface LeaveDetailDialogProps {
  open: boolean
  onClose: (updated: boolean) => void
  application: LeaveApplication | null
}

export function LeaveDetailDialog({ open, onClose, application }: LeaveDetailDialogProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaveType, setLeaveType] = useState<'ANNUAL' | 'OFF'>(application?.leaveType || 'ANNUAL')

  const handleEdit = () => {
    if (application) {
      setLeaveType(application.leaveType)
      setEditing(true)
    }
  }

  const handleSave = async () => {
    if (!application) return

    try {
      const response = await fetch(`/api/leave-management/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveType,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '수정 완료',
          description: '연차/오프가 수정되었습니다.',
        })
        setEditing(false)
        onClose(true)
      } else {
        throw new Error(result.error || '수정 실패')
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '수정 실패',
        description: error.message || '다시 시도해주세요.',
      })
    }
  }

  const handleDelete = async () => {
    if (!application) return

    if (!confirm('정말 삭제하시겠습니까?')) {
      return
    }

    try {
      setDeleting(true)
      const response = await fetch(`/api/leave-management/${application.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '삭제 완료',
          description: '연차/오프가 삭제되었습니다.',
        })
        onClose(true)
      } else {
        throw new Error(result.error || '삭제 실패')
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '삭제 실패',
        description: error.message || '다시 시도해주세요.',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleClose = () => {
    setEditing(false)
    onClose(false)
  }

  if (!application) return null

  const date = new Date(application.date)
  const formattedDate = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>연차/오프 상세</DialogTitle>
          <DialogDescription>
            {formattedDate} - {application.staff.name} ({application.staff.rank})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 타입 */}
          <div>
            <Label htmlFor="leaveType">타입</Label>
            {editing ? (
              <Select value={leaveType} onValueChange={(v) => setLeaveType(v as 'ANNUAL' | 'OFF')}>
                <SelectTrigger id="leaveType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANNUAL">연차</SelectItem>
                  <SelectItem value="OFF">오프</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 p-2 bg-gray-50 rounded">
                {application.leaveType === 'ANNUAL' ? '연차' : '오프'}
              </div>
            )}
          </div>

          {/* 상태 */}
          <div>
            <Label>상태</Label>
            <div className="mt-1 p-2 bg-gray-50 rounded">
              {application.status === 'PENDING' && '대기중'}
              {application.status === 'CONFIRMED' && '승인'}
              {application.status === 'CANCELLED' && '취소'}
              {application.status === 'REJECTED' && '반려'}
            </div>
          </div>
        </div>

        <DialogFooter>
          {editing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                <X className="w-4 h-4 mr-1" />
                취소
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-1" />
                저장
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                닫기
              </Button>
              <Button
                variant="outline"
                onClick={handleEdit}
              >
                <Edit className="w-4 h-4 mr-1" />
                수정
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {deleting ? '삭제 중...' : '삭제'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
