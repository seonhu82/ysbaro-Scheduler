/**
 * 출퇴근 이력 조회 페이지
 * 경로: /attendance/history
 *
 * 기능:
 * - 날짜별 출퇴근 기록 조회
 * - 직원별 필터링
 * - 의심 패턴 필터링
 * - Excel 다운로드
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Clock, Download, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AttendanceRecord {
  id: string
  staffId: string
  staff: {
    name: string
    rank: string
  }
  checkType: 'IN' | 'OUT'
  checkTime: string
  date: string
  isSuspicious: boolean
  suspiciousReason: string | null
}

export default function AttendanceHistoryPage() {
  const { toast } = useToast()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [staffFilter, setStaffFilter] = useState<string>('all')
  const [suspiciousFilter, setSuspiciousFilter] = useState<string>('all')

  const fetchRecords = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (staffFilter !== 'all') params.append('staffId', staffFilter)
      if (suspiciousFilter !== 'all') params.append('suspicious', suspiciousFilter)

      const response = await fetch(`/api/attendance/records?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setRecords(data.data)
      } else {
        toast({
          variant: 'destructive',
          title: '데이터 로드 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  const handleExport = async () => {
    toast({
      title: 'Excel 다운로드',
      description: '준비 중입니다...'
    })
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">출퇴근 이력</h1>
        <p className="text-gray-600">
          출퇴근 기록을 조회하고 관리합니다
        </p>
      </div>

      {/* 필터 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>검색 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">시작 날짜</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">종료 날짜</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <Label>의심 패턴</Label>
              <Select value={suspiciousFilter} onValueChange={setSuspiciousFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="true">의심만</SelectItem>
                  <SelectItem value="false">정상만</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={fetchRecords} className="flex-1">
                조회
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 기록 테이블 */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">직원</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">직급</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">구분</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-500" />
                    <p className="text-gray-500">로딩 중...</p>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    기록이 없습니다
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(record.date).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {new Date(record.checkTime).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {record.staff.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {record.staff.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Badge variant={record.checkType === 'IN' ? 'default' : 'secondary'}>
                        {record.checkType === 'IN' ? '출근' : '퇴근'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {record.isSuspicious ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            의심
                          </Badge>
                          {record.suspiciousReason && (
                            <span className="text-xs text-gray-500">
                              {record.suspiciousReason}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          정상
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 통계 푸터 */}
        {!loading && records.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t">
            <div className="flex justify-between text-sm text-gray-600">
              <span>총 {records.length}건</span>
              <div className="flex gap-4">
                <span>
                  출근: <span className="font-semibold">{records.filter(r => r.checkType === 'IN').length}</span>
                </span>
                <span>
                  퇴근: <span className="font-semibold">{records.filter(r => r.checkType === 'OUT').length}</span>
                </span>
                <span>
                  의심: <span className="font-semibold text-amber-600">{records.filter(r => r.isSuspicious).length}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
