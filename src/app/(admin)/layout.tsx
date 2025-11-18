import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/auth'
import Link from 'next/link'
import { signOut } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // 권한 확인 - SUPER_ADMIN만 접근 가능
  if (!session?.user || !isSuperAdmin((session.user as any).role)) {
    redirect('/login')
  }

  const user = session.user as any

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 바 */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* 로고 */}
              <Link href="/admin/dashboard" className="flex items-center">
                <span className="text-xl font-bold text-blue-600">
                  시스템 관리자
                </span>
              </Link>

              {/* 메뉴 */}
              <div className="ml-10 flex space-x-8">
                <NavLink href="/admin/dashboard">대시보드</NavLink>
                <NavLink href="/admin/users">회원 관리</NavLink>
                <NavLink href="/admin/tablets">태블릿 관리</NavLink>
                <NavLink href="/admin/clinics">병원 관리</NavLink>
                <NavLink href="/admin/logs">시스템 로그</NavLink>
                <NavLink href="/admin/settings">설정</NavLink>
              </div>
            </div>

            {/* 사용자 정보 */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{user.name}</span>
              <span className="text-xs text-gray-500 bg-blue-100 px-2 py-1 rounded">
                {user.role}
              </span>
              <form
                action={async () => {
                  'use server'
                  await signOut()
                }}
              >
                <button
                  type="submit"
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  로그아웃
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

/**
 * 네비게이션 링크 컴포넌트
 */
function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-blue-600 hover:border-blue-600 border-b-2 border-transparent"
    >
      {children}
    </Link>
  )
}
