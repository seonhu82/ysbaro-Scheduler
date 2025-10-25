/**
 * 검증 결과 대시보드
 * 경로: /validation/dashboard
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, AlertTriangle, Info, Play, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ValidationIssue {
  type: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  staffId?: string
  staffName?: string
  category?: string
  date?: string
  message: string
  suggestion?: string
}

interface ValidationResult {
  success: boolean
  issues: ValidationIssue[]
  criticalCount: number
  warningCount: number
  infoCount: number
  autoFixSuccess?: boolean
  autoFixLog?: string
}

export default function ValidationDashboardPage() {
  const [weekInfoId, setWeekInfoId] = useState('')
  const [autoFix, setAutoFix] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const { toast } = useToast()

  const runValidation = async () => {
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
      const response = await fetch('/api/validation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekInfoId, autoFix })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
        toast({
          title: '검증 완료',
          description: data.message
        })
      } else {
        throw new Error(data.error)
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

  const getSeverityBadge = (severity: string) => {
    const config: Record<string, { label: string; variant: any; icon: any }> = {
      'CRITICAL': { label: '치명적', variant: 'destructive', icon: AlertCircle },
      'WARNING': { label: '경고', variant: 'default', icon: AlertTriangle },
      'INFO': { label: '정보', variant: 'secondary', icon: Info }
    }

    const item = config[severity] || config['INFO']
    const Icon = item.icon

    return (
      <Badge variant={item.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {item.label}
      </Badge>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">배치 검증 대시보드</h1>
        <p className="text-gray-600">
          주간 배치의 유효성을 검증하고 문제를 자동으로 수정합니다
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>검증 실행</CardTitle>
          <CardDescription>
            주차 정보 ID를 입력하여 배치 검증을 실행하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="weekInfoId">주차 정보 ID</Label>
              <Input
                id="weekInfoId"
                value={weekInfoId}
                onChange={(e) => setWeekInfoId(e.target.value)}
                placeholder="예: clxxx..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoFix"
                checked={autoFix}
                onChange={(e) => setAutoFix(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="autoFix" className="cursor-pointer">
                CRITICAL 이슈 자동 수정 (중복 배치, 연차 충돌)
              </Label>
            </div>
            <Button onClick={runValidation} disabled={loading}>
              <Play className="w-4 h-4 mr-2" />
              {loading ? '검증 중...' : '검증 실행'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className={result.criticalCount > 0 ? 'border-red-200 bg-red-50' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">치명적 이슈</p>
                    <p className="text-3xl font-bold text-red-600">{result.criticalCount}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card className={result.warningCount > 0 ? 'border-amber-200 bg-amber-50' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">경고</p>
                    <p className="text-3xl font-bold text-amber-600">{result.warningCount}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">정보</p>
                    <p className="text-3xl font-bold text-blue-600">{result.infoCount}</p>
                  </div>
                  <Info className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {result.autoFixSuccess && result.autoFixLog && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription>
                <div className="font-medium text-green-900 mb-2">자동 수정 완료</div>
                <pre className="text-xs text-green-800 whitespace-pre-wrap">{result.autoFixLog}</pre>
              </AlertDescription>
            </Alert>
          )}

          {result.issues.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>발견된 이슈 ({result.issues.length}건)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.issues.map((issue, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getSeverityBadge(issue.severity)}
                            <Badge variant="outline">{issue.type}</Badge>
                            {issue.staffName && (
                              <span className="text-sm text-gray-600">{issue.staffName}</span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {issue.message}
                          </p>
                          {issue.suggestion && (
                            <p className="text-xs text-gray-600">
                              💡 {issue.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-900">
                <strong>검증 통과!</strong> 발견된 이슈가 없습니다.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  )
}
