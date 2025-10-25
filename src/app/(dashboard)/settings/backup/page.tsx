/**
 * 백업/복원 페이지
 * 경로: /settings/backup
 *
 * 기능:
 * - 데이터 백업 생성
 * - 백업 파일 다운로드
 * - 백업 목록 조회
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Database, Download, Upload, RefreshCw, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Backup {
  id: string
  filename: string
  size: number
  createdAt: string
}

export default function BackupSettingsPage() {
  const { toast } = useToast()
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchBackups()
  }, [])

  const fetchBackups = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/backup')
      const data = await response.json()

      if (data.success) {
        setBackups(data.data || [])
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    try {
      setCreating(true)
      const response = await fetch('/api/settings/backup', {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '백업 생성 완료',
          description: '데이터 백업이 성공적으로 생성되었습니다'
        })
        fetchBackups()
      } else {
        toast({
          variant: 'destructive',
          title: '백업 생성 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDownload = async (backupId: string) => {
    toast({
      title: '다운로드 준비 중',
      description: '백업 파일을 다운로드합니다...'
    })
    // 실제 다운로드 로직은 API 구현 필요
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Database className="w-7 h-7" />
          백업/복원
        </h1>
        <p className="text-gray-600">
          시스템 데이터를 백업하고 복원합니다
        </p>
      </div>

      {/* 경고 메시지 */}
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                백업 중요 안내
              </p>
              <p className="text-sm text-amber-800 mt-1">
                • 백업은 정기적으로 수행하는 것이 좋습니다<br />
                • 중요한 작업 전에는 반드시 백업을 생성하세요<br />
                • 백업 파일은 안전한 장소에 별도로 보관하세요
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 백업 생성 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>새 백업 생성</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                현재 시스템의 모든 데이터를 백업합니다
              </p>
              <p className="text-xs text-gray-500">
                백업에는 스케줄, 직원 정보, 연차 신청 등 모든 데이터가 포함됩니다
              </p>
            </div>
            <Button onClick={handleCreateBackup} disabled={creating}>
              <Database className="w-4 h-4 mr-2" />
              {creating ? '생성 중...' : '백업 생성'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 백업 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>백업 목록</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchBackups}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">파일명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">크기</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-500" />
                    <p className="text-gray-500">로딩 중...</p>
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">백업 파일이 없습니다</p>
                    <p className="text-xs text-gray-400 mt-1">
                      위의 '백업 생성' 버튼을 클릭하여 첫 백업을 생성하세요
                    </p>
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {backup.filename}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Badge variant="outline">{formatFileSize(backup.size)}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(backup.createdAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(backup.id)}
                      >
                        <Download className="w-4 h-4 text-blue-500" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
