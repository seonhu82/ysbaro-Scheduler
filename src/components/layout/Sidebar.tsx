'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

const navigation = [
  {
    name: '캘린더',
    href: '/calendar',
    icon: '📅',
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    name: '스케줄 관리',
    href: '/schedule',
    icon: '📆',
    roles: ['ADMIN', 'MANAGER'],
    children: [
      {
        name: '원장 스케줄 배치',
        href: '/schedule/auto-assign',
        icon: '👨‍⚕️',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        name: '직원 스케줄 배치',
        href: '/schedule/monthly-wizard',
        icon: '👥',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        name: '슬롯 현황',
        href: '/schedule/slots',
        icon: '📊',
        roles: ['ADMIN', 'MANAGER'],
      },
    ]
  },
  {
    name: '연차/오프 관리',
    href: '/leave-management',
    icon: '📋',
    roles: ['ADMIN', 'MANAGER'],
    children: [
      {
        name: '보류 신청',
        href: '/leave-management/on-hold',
        icon: '⏸️',
        roles: ['ADMIN', 'MANAGER'],
      },
    ]
  },
  {
    name: '출퇴근 관리',
    href: '/attendance',
    icon: '⏰',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    name: '통계',
    href: '/statistics',
    icon: '📊',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    name: '공정성 모니터링',
    href: '/fairness',
    icon: '⚖️',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    name: '알림',
    href: '/notifications',
    icon: '🔔',
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    name: '활동 로그',
    href: '/logs',
    icon: '📜',
    roles: ['ADMIN'],
  },
  {
    name: '설정',
    href: '/settings',
    icon: '⚙️',
    roles: ['ADMIN', 'MANAGER'],
    children: [
      {
        name: '기본 정보 수정',
        href: '/settings/clinic-info',
        icon: '🏥',
        roles: ['ADMIN'],
      },
      {
        name: '부서/구분 관리',
        href: '/settings/departments',
        icon: '🏢',
        roles: ['ADMIN'],
      },
      {
        name: '원장 관리',
        href: '/settings/doctors',
        icon: '👨‍⚕️',
        roles: ['ADMIN'],
      },
      {
        name: '직원 관리',
        href: '/settings/staff',
        icon: '👥',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        name: '의사 조합',
        href: '/settings/combinations',
        icon: '🔗',
        roles: ['ADMIN'],
      },
      {
        name: '주간 패턴',
        href: '/settings/weekly-patterns',
        icon: '📅',
        roles: ['ADMIN'],
      },
      {
        name: '휴업일 관리',
        href: '/settings/holidays',
        icon: '🎉',
        roles: ['ADMIN'],
      },
      {
        name: '구분별 비율',
        href: '/settings/category-ratios',
        icon: '📊',
        roles: ['ADMIN'],
      },
      {
        name: '공정성 가중치',
        href: '/settings/fairness',
        icon: '⚖️',
        roles: ['ADMIN'],
      },
      {
        name: '출퇴근 설정',
        href: '/settings/attendance',
        icon: '⏰',
        roles: ['ADMIN'],
      },
      {
        name: '규칙 설정',
        href: '/settings/rules',
        icon: '📜',
        roles: ['ADMIN'],
      },
      {
        name: '알림 설정',
        href: '/settings/notifications',
        icon: '🔔',
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        name: '백업 관리',
        href: '/settings/backup',
        icon: '💾',
        roles: ['ADMIN'],
      },
    ]
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const userRole = session?.user?.role || 'STAFF'

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole)
  )

  return (
    <aside className="hidden md:block w-64 bg-white border-r border-gray-200 min-h-screen">
      <nav className="px-4 py-6 space-y-2">
        {filteredNav.map((item) => {
          const isActive = pathname?.startsWith(item.href)
          const hasChildren = 'children' in item && item.children

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.name}</span>
              </Link>

              {hasChildren && isActive && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.children.filter((child: any) => child.roles.includes(userRole)).map((child: any) => {
                    const isChildActive = pathname === child.href

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition ${
                          isChildActive
                            ? 'bg-blue-100 text-blue-800 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>{child.icon}</span>
                        <span>{child.name}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
