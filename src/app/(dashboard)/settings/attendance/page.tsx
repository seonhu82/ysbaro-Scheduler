/**
 * 출퇴근 설정 허브 페이지
 * 경로: /settings/attendance
 *
 * 서브메뉴:
 * - 출퇴근 시간 설정
 * - QR/인증 설정
 * - 의심 패턴 감지 설정
 */

'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import {
  Clock,
  QrCode,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'

interface SettingCard {
  title: string
  description: string
  icon: React.ReactNode
  path: string
  color: string
}

const ATTENDANCE_SETTINGS: SettingCard[] = [
  {
    title: '출퇴근 시간 설정',
    description: '영업시간과 직원 출퇴근 시간을 설정합니다',
    icon: <Clock className="w-8 h-8" />,
    path: '/settings/attendance/time-settings',
    color: 'text-blue-600 bg-blue-100',
  },
  {
    title: 'QR 및 인증 설정',
    description: 'QR 코드 갱신 주기와 인증 방법을 설정합니다',
    icon: <QrCode className="w-8 h-8" />,
    path: '/settings/attendance/qr-settings',
    color: 'text-green-600 bg-green-100',
  },
  {
    title: '의심 패턴 감지',
    description: '지각 기준과 의심스러운 출퇴근 패턴을 감지합니다',
    icon: <AlertTriangle className="w-8 h-8" />,
    path: '/settings/attendance/detection',
    color: 'text-orange-600 bg-orange-100',
  },
]

export default function AttendanceSettingsPage() {
  const router = useRouter()

  const handleNavigate = (path: string) => {
    router.push(path)
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">출퇴근 설정</h1>
        <p className="text-gray-600">
          출퇴근 관련 설정을 관리합니다
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ATTENDANCE_SETTINGS.map((setting) => (
          <Card
            key={setting.path}
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleNavigate(setting.path)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg ${setting.color}`}>
                {setting.icon}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>

            <h3 className="text-xl font-semibold mb-2">{setting.title}</h3>
            <p className="text-gray-600 text-sm mb-4">{setting.description}</p>

            <Button
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation()
                handleNavigate(setting.path)
              }}
            >
              설정 열기
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
