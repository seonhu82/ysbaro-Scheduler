'use client'

import { useState, useEffect } from 'react'

interface FairnessSettings {
  enableNightShiftFairness: boolean
  enableWeekendFairness: boolean
  enableHolidayFairness: boolean
  enableHolidayAdjacentFairness: boolean
  fairnessThreshold: number
}

interface FairnessScore {
  staffId: string
  staffName: string
  nightShiftCount: number
  weekendCount: number
  holidayCount: number
  holidayAdjacentCount: number
}

export default function FairnessSettingsPage() {
  const [settings, setSettings] = useState<FairnessSettings>({
    enableNightShiftFairness: true,
    enableWeekendFairness: true,
    enableHolidayFairness: true,
    enableHolidayAdjacentFairness: false,
    fairnessThreshold: 0.2,
  })
  const [scores, setScores] = useState<FairnessScore[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [settingsRes, scoresRes] = await Promise.all([
        fetch('/api/settings/fairness'),
        fetch('/api/fairness/current-scores'),
      ])
      setSettings(await settingsRes.json())
      const scoresData = await scoresRes.json()
      setScores(Array.isArray(scoresData) ? scoresData : [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/fairness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        alert('저장되었습니다.')
      } else {
        alert('저장 실패')
      }
    } catch (error) {
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">로딩 중...</div>
    )
  }

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">형평성 설정</h1>

      {/* 형평성 항목 */}
      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <h2 className="text-xl font-semibold">형평성 항목</h2>
        <p className="text-sm text-gray-600">
          직원 간 근무 배치의 형평성을 유지하기 위한 설정입니다. 활성화된 항목은
          자동 배치 시 고려됩니다.
        </p>

        <div className="space-y-4">
          <SettingToggle
            label="야간 근무 형평성"
            description="야간 근무 배치 시 형평성 고려"
            checked={settings.enableNightShiftFairness}
            onChange={(checked) =>
              setSettings({ ...settings, enableNightShiftFairness: checked })
            }
          />

          <SettingToggle
            label="주말 근무 형평성"
            description="주말 근무 배치 시 형평성 고려"
            checked={settings.enableWeekendFairness}
            onChange={(checked) =>
              setSettings({ ...settings, enableWeekendFairness: checked })
            }
          />

          <SettingToggle
            label="공휴일 근무 형평성"
            description="공휴일 근무 배치 시 형평성 고려"
            checked={settings.enableHolidayFairness}
            onChange={(checked) =>
              setSettings({ ...settings, enableHolidayFairness: checked })
            }
          />

          <SettingToggle
            label="공휴일 인접일 형평성"
            description="공휴일 전후 근무 배치 시 형평성 고려"
            checked={settings.enableHolidayAdjacentFairness}
            onChange={(checked) =>
              setSettings({ ...settings, enableHolidayAdjacentFairness: checked })
            }
          />
        </div>
      </div>

      {/* 형평성 임계값 */}
      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <h2 className="text-xl font-semibold">형평성 임계값</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              최대 차이 허용 비율: {(settings.fairnessThreshold * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.05"
              max="0.5"
              step="0.05"
              value={settings.fairnessThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fairnessThreshold: parseFloat(e.target.value),
                })
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5% (엄격)</span>
              <span>50% (느슨)</span>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            직원 간 근무 횟수 차이가 이 비율을 초과하면 경고가 표시됩니다.
            예: 20%로 설정 시, 평균 10회일 때 ±2회 이상 차이 나면 경고
          </p>
        </div>
      </div>

      {/* 현재 형평성 점수 */}
      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">현재 형평성 점수 (이번 달)</h2>
          <button
            onClick={fetchData}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            새로고침
          </button>
        </div>
        {scores.length === 0 ? (
          <p className="text-sm text-gray-500">아직 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {scores.map((score) => (
              <div
                key={score.staffId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <span className="font-medium">{score.staffName}</span>
                <div className="flex gap-6 text-sm">
                  {settings.enableNightShiftFairness && (
                    <span className="text-gray-600">
                      야간: <strong>{score.nightShiftCount}</strong>회
                    </span>
                  )}
                  {settings.enableWeekendFairness && (
                    <span className="text-gray-600">
                      주말: <strong>{score.weekendCount}</strong>회
                    </span>
                  )}
                  {settings.enableHolidayFairness && (
                    <span className="text-gray-600">
                      공휴일: <strong>{score.holidayCount}</strong>회
                    </span>
                  )}
                  {settings.enableHolidayAdjacentFairness && (
                    <span className="text-gray-600">
                      인접일: <strong>{score.holidayAdjacentCount}</strong>회
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

/**
 * 설정 토글 컴포넌트
 */
function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  )
}
