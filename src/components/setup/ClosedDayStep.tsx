'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X, CalendarX } from 'lucide-react'

interface ClosedDay {
  includeHolidays: boolean
  years: number[]
  regularDays: {
    dayOfWeek: number
    weekOfMonth: number
  }[]
  specificDates: string[]
}

interface ClosedDayStepProps {
  data: ClosedDay
  onChange: (data: ClosedDay) => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: '일요일' },
  { value: 1, label: '월요일' },
  { value: 2, label: '화요일' },
  { value: 3, label: '수요일' },
  { value: 4, label: '목요일' },
  { value: 5, label: '금요일' },
  { value: 6, label: '토요일' },
]

const WEEK_OF_MONTH = [
  { value: 1, label: '첫째' },
  { value: 2, label: '둘째' },
  { value: 3, label: '셋째' },
  { value: 4, label: '넷째' },
  { value: 5, label: '다섯째' },
]

export function ClosedDayStep({ data, onChange }: ClosedDayStepProps) {
  const [newYear, setNewYear] = useState(new Date().getFullYear())
  const [newRegularDay, setNewRegularDay] = useState({
    dayOfWeek: 0,
    weekOfMonth: 1,
  })
  const [newSpecificDate, setNewSpecificDate] = useState('')

  const addYear = () => {
    if (!data.years.includes(newYear)) {
      onChange({
        ...data,
        years: [...data.years, newYear].sort(),
      })
      setNewYear(newYear + 1)
    }
  }

  const removeYear = (year: number) => {
    onChange({
      ...data,
      years: data.years.filter((y) => y !== year),
    })
  }

  const addRegularDay = () => {
    const exists = data.regularDays.some(
      (rd) =>
        rd.dayOfWeek === newRegularDay.dayOfWeek &&
        rd.weekOfMonth === newRegularDay.weekOfMonth
    )
    if (!exists) {
      onChange({
        ...data,
        regularDays: [...data.regularDays, { ...newRegularDay }],
      })
    }
  }

  const removeRegularDay = (index: number) => {
    onChange({
      ...data,
      regularDays: data.regularDays.filter((_, i) => i !== index),
    })
  }

  const addSpecificDate = () => {
    if (newSpecificDate && !data.specificDates.includes(newSpecificDate)) {
      onChange({
        ...data,
        specificDates: [...data.specificDates, newSpecificDate].sort(),
      })
      setNewSpecificDate('')
    }
  }

  const removeSpecificDate = (date: string) => {
    onChange({
      ...data,
      specificDates: data.specificDates.filter((d) => d !== date),
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">휴업일 설정</h2>
        <p className="text-gray-600">
          공휴일 포함 여부와 정기 휴업일을 설정해주세요
        </p>
      </div>

      {/* 공휴일 포함 */}
      <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-holidays"
            checked={data.includeHolidays}
            onCheckedChange={(checked) =>
              onChange({ ...data, includeHolidays: checked as boolean })
            }
          />
          <Label htmlFor="include-holidays" className="cursor-pointer">
            공휴일을 휴업일로 포함
          </Label>
        </div>
        <p className="text-xs text-gray-600 mt-2 ml-6">
          한국 공휴일 (설날, 추석, 광복절 등)을 자동으로 휴업일에 포함합니다
        </p>
      </div>

      {/* 공휴일 조회 연도 */}
      {data.includeHolidays && (
        <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
          <Label className="text-sm font-semibold mb-3 block">
            공휴일 조회 연도
          </Label>
          <p className="text-xs text-gray-600 mb-3">
            공휴일 데이터를 미리 조회할 연도를 설정합니다
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            {data.years.map((year) => (
              <div
                key={year}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                <span>{year}년</span>
                <button
                  onClick={() => removeYear(year)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              type="number"
              min={2020}
              max={2050}
              value={newYear}
              onChange={(e) => setNewYear(parseInt(e.target.value))}
              className="h-9 w-32"
            />
            <Button size="sm" onClick={addYear} className="h-9 px-4">
              <Plus className="w-4 h-4 mr-1" />
              연도 추가
            </Button>
          </div>
        </div>
      )}

      {/* 정기 휴업일 */}
      <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <CalendarX className="w-5 h-5 text-blue-600" />
          <Label className="text-sm font-semibold">정기 휴업일</Label>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          매월 특정 요일을 휴업일로 설정합니다 (예: 매월 둘째주 일요일)
        </p>

        {data.regularDays.length > 0 && (
          <div className="space-y-2 mb-3">
            {data.regularDays.map((rd, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-white rounded border"
              >
                <span className="text-sm">
                  매월{' '}
                  {WEEK_OF_MONTH.find((w) => w.value === rd.weekOfMonth)?.label}
                  주{' '}
                  {DAYS_OF_WEEK.find((d) => d.value === rd.dayOfWeek)?.label}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRegularDay(index)}
                  className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-2">
          <Select
            value={newRegularDay.weekOfMonth.toString()}
            onValueChange={(value) =>
              setNewRegularDay({
                ...newRegularDay,
                weekOfMonth: parseInt(value),
              })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEK_OF_MONTH.map((week) => (
                <SelectItem key={week.value} value={week.value.toString()}>
                  {week.label}주
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={newRegularDay.dayOfWeek.toString()}
            onValueChange={(value) =>
              setNewRegularDay({ ...newRegularDay, dayOfWeek: parseInt(value) })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OF_WEEK.map((day) => (
                <SelectItem key={day.value} value={day.value.toString()}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={addRegularDay} className="h-9">
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </div>
      </div>

      {/* 특정 휴업일 */}
      <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
        <Label className="text-sm font-semibold mb-3 block">
          특정 휴업일
        </Label>
        <p className="text-xs text-gray-600 mb-3">
          특정 날짜를 휴업일로 지정합니다 (예: 병원 행사일, 임시 휴무일)
        </p>

        {data.specificDates.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {data.specificDates.map((date) => (
              <div
                key={date}
                className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
              >
                <span>{date}</span>
                <button
                  onClick={() => removeSpecificDate(date)}
                  className="hover:bg-red-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            type="date"
            value={newSpecificDate}
            onChange={(e) => setNewSpecificDate(e.target.value)}
            className="h-9 flex-1"
          />
          <Button
            size="sm"
            onClick={addSpecificDate}
            disabled={!newSpecificDate}
            className="h-9 px-4"
          >
            <Plus className="w-4 h-4 mr-1" />
            추가
          </Button>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-900">
          💡 <strong>안내:</strong> 휴업일 설정은 나중에 설정 페이지에서도 변경할
          수 있습니다. 공휴일 데이터는 공공데이터포털 API를 통해 조회됩니다.
        </p>
      </div>
    </div>
  )
}
