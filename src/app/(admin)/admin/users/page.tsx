'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface User {
  id: string
  email: string
  name: string
  role: string
  accountStatus: string
  clinicId: string | null
  clinic: {
    name: string
  } | null
  createdAt: string
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: 'all',
    role: 'all',
    search: '',
  })
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [modalType, setModalType] = useState<'approve' | 'reject' | null>(null)
  const [selectedRole, setSelectedRole] = useState('STAFF')
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [filter])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.status !== 'all') params.append('status', filter.status)
      if (filter.role !== 'all') params.append('role', filter.role)
      if (filter.search) params.append('search', filter.search)

      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedUser) return

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole }),
      })

      if (res.ok) {
        alert('승인되었습니다.')
        fetchUsers()
        setModalType(null)
        setSelectedUser(null)
      } else {
        const error = await res.json()
        alert(`승인 실패: ${error.error}`)
      }
    } catch (error) {
      alert('승인 중 오류가 발생했습니다.')
    }
  }

  const handleReject = async () => {
    if (!selectedUser || !rejectionReason) {
      alert('거절 사유를 입력해주세요.')
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      })

      if (res.ok) {
        alert('거절되었습니다.')
        fetchUsers()
        setModalType(null)
        setSelectedUser(null)
        setRejectionReason('')
      } else {
        const error = await res.json()
        alert(`거절 실패: ${error.error}`)
      }
    } catch (error) {
      alert('거절 중 오류가 발생했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      SUSPENDED: 'bg-gray-100 text-gray-800',
      DELETED: 'bg-gray-100 text-gray-400',
    }
    const labels = {
      PENDING: '대기',
      APPROVED: '승인',
      REJECTED: '거절',
      SUSPENDED: '정지',
      DELETED: '삭제',
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${colors[status as keyof typeof colors]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">회원 관리</h1>
        <Link
          href="/admin/dashboard"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← 대시보드로
        </Link>
      </div>

      {/* 필터 */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태
            </label>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">전체</option>
              <option value="PENDING">대기</option>
              <option value="APPROVED">승인</option>
              <option value="REJECTED">거절</option>
              <option value="SUSPENDED">정지</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              역할
            </label>
            <select
              value={filter.role}
              onChange={(e) => setFilter({ ...filter, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">전체</option>
              <option value="SUPER_ADMIN">슈퍼 관리자</option>
              <option value="ADMIN">관리자</option>
              <option value="MANAGER">매니저</option>
              <option value="STAFF">직원</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              검색
            </label>
            <input
              type="text"
              placeholder="이름 또는 이메일"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            사용자가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {users.map((user) => (
              <div
                key={user.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-gray-900">
                        {user.name}
                      </div>
                      {getStatusBadge(user.accountStatus)}
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {user.role}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {user.email}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      병원: {user.clinic?.name || '미지정'} •{' '}
                      가입: {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>

                  {user.accountStatus === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setModalType('approve')
                          setSelectedRole('STAFF')
                        }}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setModalType('reject')
                          setRejectionReason('')
                        }}
                        className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 승인 모달 */}
      {modalType === 'approve' && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">회원 승인</h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600">이름</div>
                <div className="font-medium">{selectedUser.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">이메일</div>
                <div className="font-medium">{selectedUser.email}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">병원</div>
                <div className="font-medium">
                  {selectedUser.clinic?.name || '미지정'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  역할 선택
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="STAFF">STAFF (일반 직원)</option>
                  <option value="MANAGER">MANAGER (관리자)</option>
                  <option value="ADMIN">ADMIN (시스템 관리자)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setModalType(null)
                  setSelectedUser(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                승인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 거절 모달 */}
      {modalType === 'reject' && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">회원 거절</h2>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600">이름</div>
                <div className="font-medium">{selectedUser.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">이메일</div>
                <div className="font-medium">{selectedUser.email}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  거절 사유 *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="거절 사유를 입력해주세요"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setModalType(null)
                  setSelectedUser(null)
                  setRejectionReason('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                거절
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
