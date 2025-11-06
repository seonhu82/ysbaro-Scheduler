/**
 * 휴업일 관리 페이지
 * 경로: /settings/holidays
 *
 * 기능:
 * - 공휴일 조회 및 추가
 * - 정기 휴무일 설정
 * - 특정 날짜 휴무일 설정
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar, Plus, Trash2, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Holiday {
  id: string
  date: string
  name: string
}

export default function HolidaysSettingsPage() {
  const { toast } = useToast()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')

  useEffect(() => {
    fetchHolidays()
  }, [])

  const fetchHolidays = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/holidays')
      const data = await response.json()

      if (data.success) {
        setHolidays(data.data?.holidays || [])
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

  const handleAddHoliday = async () => {
    if (!newHolidayDate || !newHolidayName) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: '날짜와 이름을 모두 입력해주세요'
      })
      return
    }

    try {
      const response = await fetch('/api/settings/holidays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: newHolidayDate,
          name: newHolidayName
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '추가 완료',
          description: '휴업일이 추가되었습니다'
        })
        setNewHolidayDate('')
        setNewHolidayName('')
        fetchHolidays()
      } else {
        toast({
          variant: 'destructive',
          title: '추가 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/settings/holidays/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '삭제 완료',
          description: '휴업일이 삭제되었습니다'
        })
        fetchHolidays()
      } else {
        toast({
          variant: 'destructive',
          title: '삭제 실패',
          description: data.error
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '서버 오류가 발생했습니다'
      })
    }
  }

  const handleImportPublicHolidays = async () => {
    if (!confirm('공휴일을 자동으로 불러오시겠습니까? (현재 연도 기준)')) return

    try {
      setImporting(true)
      const year = new Date().getFullYear()
      const response = await fetch('/api/settings/holidays/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '불러오기 완료',
          description: `${data.count || 0}개의 공휴일이 추가되었습니다`
        })
        fetchHolidays()
      } else {
        toast({
          variant: 'destructive',
          title: '불러오기 실패',
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
      setImporting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Calendar className="w-7 h-7" />
          휴업일 관리
        </h1>
        <p className="text-gray-600">
          병원의 휴업일과 공휴일을 관리합니다
        </p>
      </div>

      {/* 공휴일 자동 불러오기 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>공휴일 자동 불러오기</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              한국 공휴일을 자동으로 불러옵니다 (현재 연도 기준)
            </p>
            <Button onClick={handleImportPublicHolidays} disabled={importing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${importing ? 'animate-spin' : ''}`} />
              {importing ? '불러오는 중...' : '공휴일 불러오기'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 휴업일 추가 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>새 휴업일 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="holidayDate">날짜</Label>
              <Input
                id="holidayDate"
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="holidayName">이름</Label>
              <Input
                id="holidayName"
                type="text"
                placeholder="예: 설날, 어린이날"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddHoliday} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                추가
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 휴업일 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>휴업일 목록</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchHolidays}>
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">요일</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-500" />
                    <p className="text-gray-500">로딩 중...</p>
                  </td>
                </tr>
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    등록된 휴업일이 없습니다
                  </td>
                </tr>
              ) : (
                holidays.map((holiday) => {
                  const date = new Date(holiday.date)
                  const dayOfWeek = date.toLocaleDateString('ko-KR', { weekday: 'short' })

                  return (
                    <tr key={holiday.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {new Date(holiday.date).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {holiday.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <Badge variant="outline">{dayOfWeek}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && holidays.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t">
            <p className="text-sm text-gray-600">
              총 {holidays.length}개의 휴업일
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
