'use client'

import { useSession } from 'next-auth/react'

export default function CalendarPage() {
  const { data: session } = useSession()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">캘린더</h1>
        <p className="text-gray-600 mt-2">월간 스케줄을 확인하고 관리합니다</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            캘린더 뷰
          </h2>
          <p className="text-gray-600 mb-4">
            월간 스케줄 캘린더를 구현 예정입니다
          </p>
          {session && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg inline-block">
              <p className="text-sm text-gray-700">
                <span className="font-medium">로그인:</span> {session.user.name}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">역할:</span> {session.user.role}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
