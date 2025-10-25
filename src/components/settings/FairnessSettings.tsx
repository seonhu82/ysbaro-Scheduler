'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Scale, Save } from 'lucide-react'

interface FairnessConfig {
  nightShiftWeight: number
  weekendShiftWeight: number
  holidayShiftWeight: number
  consecutiveWorkPenalty: number
  fairnessThresholdExcellent: number
  fairnessThresholdGood: number
  fairnessThresholdFair: number
}

export function FairnessSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<FairnessConfig>({
    nightShiftWeight: 3,
    weekendShiftWeight: 2,
    holidayShiftWeight: 2.5,
    consecutiveWorkPenalty: 1.5,
    fairnessThresholdExcellent: 90,
    fairnessThresholdGood: 75,
    fairnessThresholdFair: 60
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/fairness')
      const result = await response.json()
      if (result.success) {
        setConfig(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch fairness config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/settings/fairness', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const result = await response.json()

      if (result.success) {
        alert('형평성 설정이 저장되었습니다')
      } else {
        alert(result.error || '저장에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to save fairness config:', error)
      alert('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-center py-8">로딩 중...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6" />
            형평성 설정
          </h2>
          <p className="text-gray-600 mt-1">
            스케줄 배치 시 형평성 계산에 사용되는 가중치를 설정합니다
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 가중치 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>근무 유형별 가중치</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nightShiftWeight">야간 근무 가중치</Label>
              <Input
                id="nightShiftWeight"
                type="number"
                step="0.1"
                min={1}
                max={5}
                value={config.nightShiftWeight}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    nightShiftWeight: parseFloat(e.target.value)
                  })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                야간 근무에 대한 형평성 가중치 (높을수록 중요)
              </p>
            </div>

            <div>
              <Label htmlFor="weekendShiftWeight">주말 근무 가중치</Label>
              <Input
                id="weekendShiftWeight"
                type="number"
                step="0.1"
                min={1}
                max={5}
                value={config.weekendShiftWeight}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    weekendShiftWeight: parseFloat(e.target.value)
                  })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                주말 근무에 대한 형평성 가중치
              </p>
            </div>

            <div>
              <Label htmlFor="holidayShiftWeight">공휴일 근무 가중치</Label>
              <Input
                id="holidayShiftWeight"
                type="number"
                step="0.1"
                min={1}
                max={5}
                value={config.holidayShiftWeight}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    holidayShiftWeight: parseFloat(e.target.value)
                  })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                공휴일 근무에 대한 형평성 가중치
              </p>
            </div>

            <div>
              <Label htmlFor="consecutiveWorkPenalty">연속 근무 페널티</Label>
              <Input
                id="consecutiveWorkPenalty"
                type="number"
                step="0.1"
                min={1}
                max={3}
                value={config.consecutiveWorkPenalty}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    consecutiveWorkPenalty: parseFloat(e.target.value)
                  })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                연속 근무에 대한 페널티 계수
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 형평성 등급 기준 */}
        <Card>
          <CardHeader>
            <CardTitle>형평성 등급 기준</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="fairnessThresholdExcellent">
                우수 (Excellent) 기준점
              </Label>
              <Input
                id="fairnessThresholdExcellent"
                type="number"
                min={0}
                max={100}
                value={config.fairnessThresholdExcellent}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    fairnessThresholdExcellent: parseInt(e.target.value)
                  })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                이 점수 이상이면 우수 등급 (기본: 90점)
              </p>
            </div>

            <div>
              <Label htmlFor="fairnessThresholdGood">양호 (Good) 기준점</Label>
              <Input
                id="fairnessThresholdGood"
                type="number"
                min={0}
                max={100}
                value={config.fairnessThresholdGood}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    fairnessThresholdGood: parseInt(e.target.value)
                  })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                이 점수 이상이면 양호 등급 (기본: 75점)
              </p>
            </div>

            <div>
              <Label htmlFor="fairnessThresholdFair">보통 (Fair) 기준점</Label>
              <Input
                id="fairnessThresholdFair"
                type="number"
                min={0}
                max={100}
                value={config.fairnessThresholdFair}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    fairnessThresholdFair: parseInt(e.target.value)
                  })
                }
              />
              <p className="text-sm text-gray-500 mt-1">
                이 점수 이상이면 보통 등급, 미만이면 미흡 (Poor) (기본: 60점)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 저장 버튼 */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {saving ? '저장 중...' : '설정 저장'}
          </Button>
        </div>
      </div>
    </div>
  )
}
