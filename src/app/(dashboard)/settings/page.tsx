'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import {
  Users,
  UserCog,
  Stethoscope,
  Calendar,
  Shield,
  Database,
  Clock,
  Settings as SettingsIcon,
  ChevronRight,
} from 'lucide-react'

interface SettingCard {
  title: string
  description: string
  icon: React.ReactNode
  path: string
  color: string
}

const SETTING_CARDS: SettingCard[] = [
  {
    title: '직원 관리',
    description: '직원 정보를 등록하고 관리합니다',
    icon: <Users className="w-8 h-8" />,
    path: '/settings/staff',
    color: 'text-blue-600 bg-blue-100',
  },
  {
    title: '원장 관리',
    description: '원장 정보를 등록하고 근무 패턴을 설정합니다',
    icon: <Stethoscope className="w-8 h-8" />,
    path: '/settings/doctors',
    color: 'text-green-600 bg-green-100',
  },
  {
    title: '공휴일 관리',
    description: '공휴일과 휴무일을 설정합니다',
    icon: <Calendar className="w-8 h-8" />,
    path: '/settings/holidays',
    color: 'text-purple-600 bg-purple-100',
  },
  {
    title: '규칙 설정',
    description: '스케줄 생성 규칙과 제약사항을 설정합니다',
    icon: <Shield className="w-8 h-8" />,
    path: '/settings/rules',
    color: 'text-orange-600 bg-orange-100',
  },
  {
    title: '출퇴근 설정',
    description: '출퇴근 시간, 인증 방법, 의심 패턴 감지를 설정합니다',
    icon: <Clock className="w-8 h-8" />,
    path: '/settings/attendance',
    color: 'text-cyan-600 bg-cyan-100',
  },
  {
    title: '백업 및 복원',
    description: '데이터를 백업하고 복원합니다',
    icon: <Database className="w-8 h-8" />,
    path: '/settings/backup',
    color: 'text-gray-600 bg-gray-100',
  },
]

export default function SettingsPage() {
  const router = useRouter()

  const handleNavigate = (path: string) => {
    router.push(path)
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-8 h-8 text-gray-700" />
          <h1 className="text-3xl font-bold">설정</h1>
        </div>
        <p className="text-gray-600">
          시스템의 각종 설정을 관리합니다
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SETTING_CARDS.map((setting) => (
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
