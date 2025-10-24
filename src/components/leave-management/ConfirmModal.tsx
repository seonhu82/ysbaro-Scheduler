'use client'

import { Button } from '@/components/ui/button'

interface ConfirmModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  message: string
}

export function ConfirmModal({ isOpen, onConfirm, onCancel, message }: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
        <p className="mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>취소</Button>
          <Button onClick={onConfirm}>확인</Button>
        </div>
      </div>
    </div>
  )
}
