'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { MobileMenu } from './MobileMenu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, Settings, LogOut, ChevronDown } from 'lucide-react'

export function Header() {
  const { data: session } = useSession()

  // 사용자 이름의 첫 글자 추출
  const getInitials = (name: string) => {
    return name?.charAt(0).toUpperCase() || 'U'
  }

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
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center space-x-3 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors outline-none">
                <Avatar className="h-9 w-9 border-2 border-blue-500">
                  <AvatarFallback className="bg-blue-500 text-white font-semibold">
                    {getInitials(session.user.name || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-gray-900">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-gray-500">{session.user.email}</p>
                </div>
                <ChevronDown className="hidden sm:block h-4 w-4 text-gray-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{session.user.name}</p>
                    <p className="text-xs text-gray-500">{session.user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>내 프로필</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>설정</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
