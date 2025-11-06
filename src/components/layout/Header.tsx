'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { MobileMenu } from './MobileMenu'

export function Header() {
  const { data: session } = useSession()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 🆕 모바일 메뉴 + 로고 */}
          <div className="flex items-center space-x-3">
            <MobileMenu />
            <Link
              href="/calendar"
              className="text-lg md:text-xl font-bold text-blue-600"
            >
              연세바로치과
            </Link>
            <span className="hidden sm:inline text-sm text-gray-500">
              스케줄 관리 시스템
            </span>
          </div>

          {session && (
            <div className="flex items-center space-x-2 md:space-x-4">
              {/* 사용자 정보 - 모바일에서 숨김 */}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">
                  {session.user.name}
                </p>
                <p className="text-xs text-gray-500">{session.user.email}</p>
              </div>
              {/* 로그아웃 버튼 */}
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="px-3 md:px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition min-h-[44px]"
                aria-label="로그아웃"
              >
                <span className="hidden sm:inline">로그아웃</span>
                <span className="sm:hidden">나가기</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
