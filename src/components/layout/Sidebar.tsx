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
    name: '연차 관리',
    href: '/leave-management',
    icon: '📋',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    name: '통계',
    href: '/statistics',
    icon: '📊',
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
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <nav className="px-4 py-6 space-y-2">
        {filteredNav.map((item) => {
          const isActive = pathname?.startsWith(item.href)

          return (
            <Link
              key={item.href}
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
          )
        })}
      </nav>
    </aside>
  )
}
