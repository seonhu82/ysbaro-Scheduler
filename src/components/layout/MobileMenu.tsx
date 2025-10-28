/**
 * 모바일 햄버거 메뉴 컴포넌트
 *
 * 접근성 기능:
 * - ARIA 속성으로 메뉴 상태 전달
 * - 키보드 네비게이션 지원 (Escape로 닫기)
 * - 포커스 트랩 (메뉴 열림 시)
 * - 터치 타겟 44px 이상
 * - 스크린 리더 알림
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFocusTrap, createEscapeHandler, announceToScreenReader } from '@/lib/utils/accessibility'
import { cn } from '@/lib/utils'

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
        name: '자동 배치',
        href: '/schedule/auto-assign',
        icon: '🤖',
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
    name: '연차 관리',
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
    name: '근태 관리',
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

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const menuRef = useRef<HTMLDivElement>(null)

  const userRole = session?.user?.role || 'STAFF'

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole)
  )

  // 포커스 트랩 활성화
  useFocusTrap(menuRef, isOpen)

  // 페이지 변경 시 메뉴 닫기
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // body 스크롤 제어
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    announceToScreenReader('메뉴가 열렸습니다', 'polite')
  }

  const handleClose = () => {
    setIsOpen(false)
    announceToScreenReader('메뉴가 닫혔습니다', 'polite')
  }

  const handleEscape = createEscapeHandler(handleClose)

  return (
    <>
      {/* 햄버거 버튼 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        aria-label="메뉴 열기"
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        className="md:hidden"
      >
        <Menu className="w-6 h-6" />
      </Button>

      {/* 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* 메뉴 패널 */}
      <div
        ref={menuRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="모바일 네비게이션 메뉴"
        onKeyDown={handleEscape}
        className={cn(
          "fixed top-0 left-0 bottom-0 w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 md:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">메뉴</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="메뉴 닫기"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* 네비게이션 */}
        <nav className="px-4 py-6 space-y-2 overflow-y-auto max-h-[calc(100vh-80px)]">
          {filteredNav.map((item) => {
            const isActive = pathname?.startsWith(item.href)
            const hasChildren = 'children' in item && item.children

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleClose}
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg transition",
                    "min-h-[44px]", // 터치 타겟
                    isActive
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="text-xl" aria-hidden="true">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>

                {/* 하위 메뉴 */}
                {hasChildren && isActive && (
                  <div className="ml-8 mt-1 space-y-1" role="group" aria-label={`${item.name} 하위 메뉴`}>
                    {item.children.filter((child: any) => child.roles.includes(userRole)).map((child: any) => {
                      const isChildActive = pathname === child.href

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={handleClose}
                          className={cn(
                            "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition",
                            "min-h-[44px]", // 터치 타겟
                            isChildActive
                              ? "bg-blue-100 text-blue-800 font-medium"
                              : "text-gray-600 hover:bg-gray-50"
                          )}
                          aria-current={isChildActive ? 'page' : undefined}
                        >
                          <span aria-hidden="true">{child.icon}</span>
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
      </div>
    </>
  )
}
