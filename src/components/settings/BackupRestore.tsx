'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Database, Download, Upload, Trash2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Backup {
  id: string
  filename: string
  size: number
  createdAt: Date
  type: 'AUTO' | 'MANUAL'
}

export function BackupRestore() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null)

  useEffect(() => {
    fetchBackups()
  }, [])

  const fetchBackups = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/backup')
      const result = await response.json()
      if (result.success) {
        setBackups(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    if (!confirm('백업을 생성하시겠습니까?')) return

    try {
      setCreating(true)
      const response = await fetch('/api/settings/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'MANUAL' })
      })

      const result = await response.json()

      if (result.success) {
        alert('백업이 생성되었습니다')
        fetchBackups()
      } else {
        alert(result.error || '백업 생성에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to create backup:', error)
      alert('백업 생성에 실패했습니다')
    } finally {
      setCreating(false)
    }
  }

  const handleDownloadBackup = async (backup: Backup) => {
    try {
      const response = await fetch(`/api/settings/backup/${backup.id}/download`)
      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backup.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download backup:', error)
      alert('백업 다운로드에 실패했습니다')
    }
  }

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return

    try {
      setRestoring(true)
      const response = await fetch(`/api/settings/backup/${selectedBackup.id}/restore`, {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        alert('복원이 완료되었습니다. 페이지를 새로고침합니다.')
        window.location.reload()
      } else {
        alert(result.error || '복원에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to restore backup:', error)
      alert('복원에 실패했습니다')
    } finally {
      setRestoring(false)
      setRestoreDialogOpen(false)
    }
  }

  const handleDeleteBackup = async (id: string) => {
    if (!confirm('이 백업을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/settings/backup/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        alert('백업이 삭제되었습니다')
        fetchBackups()
      }
    } catch (error) {
      console.error('Failed to delete backup:', error)
      alert('백업 삭제에 실패했습니다')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6" />
            백업 및 복원
          </h2>
          <p className="text-gray-600 mt-1">
            데이터를 백업하고 이전 상태로 복원합니다
          </p>
        </div>
        <Button onClick={handleCreateBackup} disabled={creating}>
          <Download className="w-4 h-4 mr-2" />
          {creating ? '백업 생성 중...' : '백업 생성'}
        </Button>
      </div>

      {/* 경고 메시지 */}
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">주의사항</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• 백업 복원 시 현재 데이터는 완전히 교체됩니다</li>
                <li>• 복원 전 현재 상태를 백업하는 것을 권장합니다</li>
                <li>• 정기적으로 백업을 생성하여 데이터 손실을 방지하세요</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 백업 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>백업 목록 ({backups.length}개)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-gray-500">로딩 중...</p>
          ) : backups.length === 0 ? (
            <p className="text-center py-8 text-gray-500">백업이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{backup.filename}</span>
                        <Badge variant={backup.type === 'AUTO' ? 'secondary' : 'default'}>
                          {backup.type === 'AUTO' ? '자동' : '수동'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-0.5">
                        <p>크기: {formatFileSize(backup.size)}</p>
                        <p>생성: {formatDate(backup.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadBackup(backup)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBackup(backup)
                          setRestoreDialogOpen(true)
                        }}
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteBackup(backup.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 복원 확인 다이얼로그 */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>백업 복원 확인</DialogTitle>
            <DialogDescription>
              정말로 이 백업으로 복원하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          {selectedBackup && (
            <div className="space-y-4 py-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-900">
                    <p className="font-semibold mb-2">경고: 현재 데이터가 손실됩니다</p>
                    <p>복원하면 현재 모든 데이터가 아래 백업 시점의 데이터로 교체됩니다.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p><strong>백업 파일:</strong> {selectedBackup.filename}</p>
                <p><strong>생성 시각:</strong> {formatDate(selectedBackup.createdAt)}</p>
                <p><strong>크기:</strong> {formatFileSize(selectedBackup.size)}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={restoring}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestoreBackup}
              disabled={restoring}
            >
              {restoring ? '복원 중...' : '복원 실행'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
