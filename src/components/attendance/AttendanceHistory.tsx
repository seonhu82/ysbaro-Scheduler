/**
 * 출퇴근 이력 컴포넌트
 *
 * 기능:
 * - 출퇴근 기록 테이블
 * - 날짜 필터
 * - 직원 필터
 * - 지각/조퇴 표시
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AttendanceRecord {
  id: string
  date: string
  staff: {
    name: string
    rank: string
  }
  checkInTime: string | null
  checkOutTime: string | null
  isLate: boolean
  isEarlyLeave: boolean
  status: 'PRESENT' | 'ABSENT' | 'PARTIAL'
}

export function AttendanceHistory() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [staffFilter, setStaffFilter] = useState('')

  useEffect(() => {
    fetchRecords()
  }, [dateFilter, staffFilter])

  const fetchRecords = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (dateFilter) params.append('date', dateFilter)
      if (staffFilter) params.append('staffId', staffFilter)

      const response = await fetch(`/api/attendance/history?${params}`)
      const result = await response.json()

      if (result.success) {
        setRecords(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch attendance records:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (record: AttendanceRecord) => {
    if (record.status === 'ABSENT') {
      return <Badge variant="destructive">결근</Badge>
    }
    if (record.isLate && record.isEarlyLeave) {
      return <Badge variant="secondary">지각/조퇴</Badge>
    }
    if (record.isLate) {
      return <Badge variant="secondary">지각</Badge>
    }
    if (record.isEarlyLeave) {
      return <Badge variant="secondary">조퇴</Badge>
    }
    return <Badge variant="default">정상</Badge>
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-'
    return new Date(timeString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>출퇴근 이력</CardTitle>
        <div className="flex gap-4 mt-4">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            placeholder="직원 이름으로 검색"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">날짜</th>
                <th className="text-left p-2">직원</th>
                <th className="text-left p-2">출근</th>
                <th className="text-left p-2">퇴근</th>
                <th className="text-left p-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-2 text-center" colSpan={5}>
                    <p className="text-gray-500">로딩 중...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="p-2 text-center" colSpan={5}>
                    <p className="text-gray-500">기록이 없습니다.</p>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">{record.date}</td>
                    <td className="p-2">
                      {record.staff.name} ({record.staff.rank})
                    </td>
                    <td className="p-2">
                      <span className={record.isLate ? 'text-red-600' : ''}>
                        {formatTime(record.checkInTime)}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className={record.isEarlyLeave ? 'text-red-600' : ''}>
                        {formatTime(record.checkOutTime)}
                      </span>
                    </td>
                    <td className="p-2">{getStatusBadge(record)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
