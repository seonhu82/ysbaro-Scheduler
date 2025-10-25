/**
 * 백업 관리 페이지
 * 경로: /settings/backup
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Database, Download, Trash2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Backup {
  id: string
  backupType: string
  description: string | null
  createdAt: string
  createdBy: string | null
  restoredAt: string | null
  restoredBy: string | null
}

export default function BackupManagementPage() {
  const [weekInfoId, setWeekInfoId] = useState('')
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [description, setDescription] = useState('')
  const { toast } = useToast()

  const loadBackups = async () => {
    if (!weekInfoId.trim()) {
      toast({
        title: '주차 ID 입력 필요',
        description: '주차 정보 ID를 입력하세요',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/backup/list?weekInfoId=${weekInfoId}`)
      const result = await response.json()

      if (result.success) {
        setBackups(result.data)
        toast({
          title: '백업 목록 로드 완료',
          description: `${result.data.length}개의 백업을 찾았습니다`
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    if (!weekInfoId.trim()) {
      toast({
        title: '주차 ID 입력 필요',
        description: '주차 정보 ID를 입력하세요',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekInfoId,
          description: description || undefined
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '백업 생성 완료',
          description: result.message
        })
        setShowCreateDialog(false)
        setDescription('')
        loadBackups()
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!selectedBackup) return

    try {
      setLoading(true)
      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupId: selectedBackup.id
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '복구 완료',
          description: `${result.data.restoredCount}명의 배치가 복원되었습니다`
        })
        setShowRestoreDialog(false)
        setSelectedBackup(null)
        loadBackups()
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    if (!weekInfoId.trim()) {
      toast({
        title: '주차 ID 입력 필요',
        description: '주차 정보 ID를 입력하세요',
        variant: 'destructive'
      })
      return
    }

    if (!confirm('오래된 백업을 삭제하시겠습니까? (최근 5개만 유지)')) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/backup/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekInfoId,
          keepCount: 5
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: '정리 완료',
          description: result.message
        })
        loadBackups()
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getBackupTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; variant: any }> = {
      'AUTO_BEFORE_ASSIGN': { label: '자동(배치전)', variant: 'secondary' },
      'AUTO_AFTER_ASSIGN': { label: '자동(배치후)', variant: 'default' },
      'BEFORE_LEAVE_CHANGE': { label: '자동(연차변경전)', variant: 'outline' },
      'MANUAL': { label: '수동', variant: 'destructive' }
    }

    const config = typeMap[type] || { label: type, variant: 'default' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">백업 관리</h1>
        <p className="text-gray-600">
          주간 배치 데이터의 백업 및 복구를 관리합니다
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            백업 조회
          </CardTitle>
          <CardDescription>
            주차 정보 ID를 입력하여 백업 목록을 조회하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="weekInfoId">주차 정보 ID</Label>
              <Input
                id="weekInfoId"
                value={weekInfoId}
                onChange={(e) => setWeekInfoId(e.target.value)}
                placeholder="예: clxxx..."
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={loadBackups} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                조회
              </Button>
              <Button onClick={() => setShowCreateDialog(true)} disabled={loading}>
                <Database className="w-4 h-4 mr-2" />
                수동 백업
              </Button>
              <Button onClick={handleCleanup} variant="outline" disabled={loading}>
                <Trash2 className="w-4 h-4 mr-2" />
                정리
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {backups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>백업 목록 ({backups.length}개)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>유형</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead>생성일시</TableHead>
                  <TableHead>복구일시</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>{getBackupTypeBadge(backup.backupType)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {backup.description || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(backup.createdAt).toLocaleString('ko-KR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {backup.restoredAt ? (
                        <Badge variant="outline" className="bg-green-50">
                          {new Date(backup.restoredAt).toLocaleString('ko-KR')}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBackup(backup)
                          setShowRestoreDialog(true)
                        }}
                        disabled={loading}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        복구
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 복구 확인 다이얼로그 */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              백업 복구 확인
            </DialogTitle>
            <DialogDescription>
              이 백업으로 복구하시겠습니까? 현재 배치 데이터는 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          {selectedBackup && (
            <div className="space-y-2 py-4">
              <p className="text-sm"><strong>유형:</strong> {selectedBackup.backupType}</p>
              <p className="text-sm"><strong>설명:</strong> {selectedBackup.description || '-'}</p>
              <p className="text-sm"><strong>생성일시:</strong> {new Date(selectedBackup.createdAt).toLocaleString('ko-KR')}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              취소
            </Button>
            <Button onClick={handleRestore} disabled={loading}>
              <CheckCircle className="w-4 h-4 mr-2" />
              복구 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수동 백업 생성 다이얼로그 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              수동 백업 생성
            </DialogTitle>
            <DialogDescription>
              현재 배치 상태를 백업합니다
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="description">설명 (선택)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="백업 사유를 입력하세요"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              취소
            </Button>
            <Button onClick={handleCreateBackup} disabled={loading}>
              <Database className="w-4 h-4 mr-2" />
              백업 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
