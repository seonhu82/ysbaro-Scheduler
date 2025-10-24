'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function AutoAssignPage() {
  const { toast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleWeeklyAssign = async () => {
    if (!startDate) {
      toast({
        title: '날짜 선택 필요',
        description: '주간 스케줄 시작 날짜를 선택해주세요',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/auto-assign/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
        toast({
          title: '자동 배치 완료',
          description: `${data.slotsCreated}개의 일일 스케줄이 생성되었습니다`
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({
        title: '자동 배치 실패',
        description: error.message || '다시 시도해주세요',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">자동 배치</h1>
        <p className="text-gray-600">
          주간 스케줄을 자동으로 생성하고 직원을 배치합니다
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 입력 폼 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              주간 스케줄 생성
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="startDate">시작 날짜 (월요일)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                월요일 날짜를 선택하면 해당 주(월~일)의 스케줄이 생성됩니다
              </p>
            </div>

            <Button
              onClick={handleWeeklyAssign}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  자동 배치 중...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  자동 배치 실행
                </>
              )}
            </Button>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm text-blue-900 mb-2">
                자동 배치 방식
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 구분별 비율에 따라 직원 배치</li>
                <li>• 형평성 점수가 낮은 직원 우선 배치</li>
                <li>• 부족한 구분은 유연 배치 직원으로 충원</li>
                <li>• 공휴일 및 공휴일 전후 형평성 고려</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 오른쪽: 결과 표시 */}
        <Card>
          <CardHeader>
            <CardTitle>배치 결과</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center text-gray-500 py-12">
                자동 배치를 실행하면 결과가 여기에 표시됩니다
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-semibold">배치 완료</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">주 ID</div>
                    <div className="font-mono text-sm">{result.weekId}</div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">생성된 슬롯</div>
                    <div className="text-2xl font-bold">{result.slotsCreated}개</div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-900">
                    7일간의 스케줄이 생성되고 직원 배치가 완료되었습니다.
                    스케줄 관리 페이지에서 확인하세요.
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
