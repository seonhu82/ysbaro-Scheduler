'use client'

import { useState, useRef } from 'react'
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
import { Plus, X, Calendar, Users, Upload, Download, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Doctor {
  name: string
  useCategory: boolean
  categories: string[]
}

interface Combination {
  name: string
  dayOfWeek: string
  requiredStaff: number
  doctors: string[]
}

interface Fairness {
  enabled: boolean
  includeHolidays: boolean
}

interface CombinationStepProps {
  data: Combination[]
  doctors: Doctor[]
  fairness: Fairness
  onChange: (data: Combination[]) => void
  onFairnessChange: (fairness: Fairness) => void
}

const DAYS_OF_WEEK = [
  { value: 'MONDAY', label: '월요일' },
  { value: 'TUESDAY', label: '화요일' },
  { value: 'WEDNESDAY', label: '수요일' },
  { value: 'THURSDAY', label: '목요일' },
  { value: 'FRIDAY', label: '금요일' },
  { value: 'SATURDAY', label: '토요일' },
  { value: 'SUNDAY', label: '일요일' },
]

export function CombinationStep({
  data,
  doctors,
  fairness,
  onChange,
  onFairnessChange,
}: CombinationStepProps) {
  const [newCombination, setNewCombination] = useState<Combination>({
    name: '',
    dayOfWeek: 'MONDAY',
    requiredStaff: 2,
    doctors: [],
  })
  const [selectedDoctorIndex, setSelectedDoctorIndex] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 의사 목록 생성 (구분 포함)
  const getDoctorOptions = () => {
    const options: string[] = []
    doctors.forEach((doctor) => {
      if (doctor.useCategory && doctor.categories.length > 0) {
        doctor.categories.forEach((category) => {
          options.push(`${doctor.name}(${category})`)
        })
      } else {
        options.push(doctor.name)
      }
    })
    return options
  }

  const doctorOptions = getDoctorOptions()

  const addDoctorToCombination = () => {
    if (selectedDoctorIndex !== null) {
      const doctor = doctorOptions[selectedDoctorIndex]
      if (!newCombination.doctors.includes(doctor)) {
        setNewCombination({
          ...newCombination,
          doctors: [...newCombination.doctors, doctor],
        })
      }
      setSelectedDoctorIndex(null)
    }
  }

  const removeDoctorFromCombination = (index: number) => {
    setNewCombination({
      ...newCombination,
      doctors: newCombination.doctors.filter((_, i) => i !== index),
    })
  }

  const addCombination = () => {
    if (newCombination.name.trim() && newCombination.doctors.length > 0) {
      onChange([...data, { ...newCombination }])
      setNewCombination({
        name: '',
        dayOfWeek: 'MONDAY',
        requiredStaff: 2,
        doctors: [],
      })
    }
  }

  const removeCombination = (index: number) => {
    onChange(data.filter((_, i) => i !== index))
  }

  
  // 엑셀 템플릿 다운로드
  const downloadTemplate = () => {
    const templateData = [
      {
        조합명: '박(상담)구윤',
        요일: '월요일',
        필요인원: 2,
        의사1: '박원장(상담)',
        의사2: '구원장',
        의사3: '윤원장',
      },
      {
        조합명: '구윤',
        요일: '월요일',
        필요인원: 2,
        의사1: '구원장',
        의사2: '윤원장',
        의사3: '',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '의사조합')

    ws['!cols'] = [
      { wch: 15 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ]

    // 의사 목록 시트 추가 (참조용)
    const doctorListData = doctorOptions.map(name => ({ 의사명: name }))
    const doctorListSheet = XLSX.utils.json_to_sheet(doctorListData)
    XLSX.utils.book_append_sheet(wb, doctorListSheet, '의사목록')

    // 데이터 유효성 검사 추가 (드롭다운)
    // Note: xlsx 라이브러리는 데이터 유효성 검사를 완벽하게 지원하지 않으므로
    // 사용자가 의사목록 시트를 참조하여 직접 입력하도록 안내합니다

    XLSX.writeFile(wb, '의사조합_템플릿.xlsx')
  }


  // 엑셀 파일 업로드 처리
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError('')

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

        if (jsonData.length === 0) {
          setUploadError('엑셀 파일에 데이터가 없습니다.')
          return
        }

        const newCombinations: Combination[] = []
        const errors: string[] = []

        jsonData.forEach((row, index) => {
          const rowNum = index + 2

          // 필수 필드 검증
          if (!row['조합명']) {
            errors.push(`${rowNum}행: 조합명이 누락되었습니다.`)
            return
          }

          if (!row['요일']) {
            errors.push(`${rowNum}행: 요일이 누락되었습니다.`)
            return
          }

          // 요일 변환
          const dayMapping: { [key: string]: string } = {
            월요일: 'MONDAY',
            화요일: 'TUESDAY',
            수요일: 'WEDNESDAY',
            목요일: 'THURSDAY',
            금요일: 'FRIDAY',
            토요일: 'SATURDAY',
            일요일: 'SUNDAY',
            월: 'MONDAY',
            화: 'TUESDAY',
            수: 'WEDNESDAY',
            목: 'THURSDAY',
            금: 'FRIDAY',
            토: 'SATURDAY',
            일: 'SUNDAY',
          }

          const dayStr = String(row['요일']).trim()
          const dayOfWeek = dayMapping[dayStr]
          if (!dayOfWeek) {
            errors.push(`${rowNum}행: 올바르지 않은 요일입니다. (${dayStr})`)
            return
          }

          // 필요인원 검증
          const requiredStaff = parseInt(String(row['필요인원'] || '2'))
          if (isNaN(requiredStaff) || requiredStaff < 1) {
            errors.push(`${rowNum}행: 필요인원은 1 이상의 숫자여야 합니다.`)
            return
          }

          // 의사 수집
          const combinationDoctors: string[] = []
          for (let i = 1; i <= 10; i++) {
            const doctorKey = `의사${i}`
            if (row[doctorKey] && String(row[doctorKey]).trim()) {
              const doctorName = String(row[doctorKey]).trim()

              // 의사 존재 여부 확인
              if (!doctorOptions.includes(doctorName)) {
                errors.push(
                  `${rowNum}행: 존재하지 않는 의사입니다. (${doctorName})`
                )
                return
              }

              combinationDoctors.push(doctorName)
            }
          }

          if (combinationDoctors.length === 0) {
            errors.push(`${rowNum}행: 최소 1명의 의사가 필요합니다.`)
            return
          }

          newCombinations.push({
            name: String(row['조합명']).trim(),
            dayOfWeek,
            requiredStaff,
            doctors: combinationDoctors,
          })
        })

        if (errors.length > 0) {
          setUploadError(errors.join('\n'))
          return
        }

        // 기존 데이터에 추가
        onChange([...data, ...newCombinations])

        alert(`${newCombinations.length}개의 조합이 추가되었습니다.`)

        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } catch (error) {
        console.error('Excel upload error:', error)
        setUploadError('엑셀 파일을 읽는 중 오류가 발생했습니다.')
      }
    }

    reader.readAsBinaryString(file)
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">의사 조합 설정</h2>
        <p className="text-gray-600">
          일 패턴에 사용될 의사 조합을 요일별로 설정해주세요
        </p>
      </div>

      {/* 엑셀 업로드 섹션 */}
      <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-green-600" />
            <div>
              <h3 className="font-semibold text-gray-900">엑셀로 일괄 등록</h3>
              <p className="text-sm text-gray-600">
                여러 개의 조합을 한 번에 등록할 수 있습니다
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="h-9 border-green-300 hover:bg-green-50"
            >
              <Download className="w-4 h-4 mr-1" />
              템플릿 다운로드
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-4 h-4 mr-1" />
              엑셀 업로드
            </Button>
          </div>
        </div>
      </div>

      {/* 업로드 에러 메시지 */}
      {uploadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-line">
            {uploadError}
          </AlertDescription>
        </Alert>
      )}

      {/* 조합 목록 */}
      {data.length > 0 && (
        <div className="space-y-3">
          {data.map((combination, index) => (
            <div
              key={index}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{combination.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        📅{' '}
                        {DAYS_OF_WEEK.find((d) => d.value === combination.dayOfWeek)
                          ?.label || combination.dayOfWeek}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        👥 필요인원: {combination.requiredStaff}명
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCombination(index)}
                  className="hover:bg-red-100 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="ml-8">
                <Label className="text-xs text-gray-500 mb-2 block">
                  의사 구성:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {combination.doctors.map((doctor, docIndex) => (
                    <span
                      key={docIndex}
                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {doctor}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 새 조합 추가 */}
      <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">새 조합 추가</h3>
        </div>

        <div className="space-y-4">
          {/* 조합명, 요일, 필요인원 */}
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">조합명 *</Label>
              <Input
                value={newCombination.name}
                onChange={(e) =>
                  setNewCombination({ ...newCombination, name: e.target.value })
                }
                placeholder="예: 박(상담)구윤"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">요일 *</Label>
              <Select
                value={newCombination.dayOfWeek}
                onValueChange={(value) =>
                  setNewCombination({ ...newCombination, dayOfWeek: value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day.value} value={day.value}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">필요인원 *</Label>
              <Input
                type="number"
                min={1}
                value={newCombination.requiredStaff}
                onChange={(e) =>
                  setNewCombination({
                    ...newCombination,
                    requiredStaff: parseInt(e.target.value) || 1,
                  })
                }
                className="h-9"
              />
            </div>
          </div>

          {/* 의사 선택 */}
          <div className="space-y-2">
            <Label className="text-xs">의사 선택 *</Label>
            <div className="flex gap-2">
              <Select
                value={
                  selectedDoctorIndex !== null
                    ? selectedDoctorIndex.toString()
                    : undefined
                }
                onValueChange={(value) =>
                  setSelectedDoctorIndex(parseInt(value))
                }
              >
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue placeholder="의사를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {doctorOptions.map((doctor, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {doctor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={addDoctorToCombination}
                disabled={selectedDoctorIndex === null}
                className="h-9 px-4"
              >
                <Plus className="w-4 h-4 mr-1" />
                추가
              </Button>
            </div>

            {/* 선택된 의사 목록 */}
            {newCombination.doctors.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-white rounded border">
                {newCombination.doctors.map((doctor, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    <span>{doctor}</span>
                    <button
                      onClick={() => removeDoctorFromCombination(index)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={addCombination}
            disabled={
              !newCombination.name.trim() || newCombination.doctors.length === 0
            }
            className="w-full h-10 bg-blue-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            조합 추가
          </Button>
        </div>
      </div>

      {/* 형평성 설정 */}
      <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="font-semibold mb-3">형평성 기반 근무 배치</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="fairness-enabled"
              checked={fairness.enabled}
              onCheckedChange={(checked) =>
                onFairnessChange({ ...fairness, enabled: checked as boolean })
              }
            />
            <Label htmlFor="fairness-enabled" className="cursor-pointer">
              형평성 기반 근무 배치 사용
            </Label>
          </div>

          {fairness.enabled && (
            <div className="ml-6 flex items-center space-x-2">
              <Checkbox
                id="fairness-holidays"
                checked={fairness.includeHolidays}
                onCheckedChange={(checked) =>
                  onFairnessChange({
                    ...fairness,
                    includeHolidays: checked as boolean,
                  })
                }
              />
              <Label htmlFor="fairness-holidays" className="cursor-pointer">
                공휴일 근무도 형평성에 포함
              </Label>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-900">
          💡 <strong>안내:</strong> 의사 조합은 하루의 진료 패턴을 의미합니다.
          예를 들어 "월요일 조합"으로 박(상담)구윤 / 구윤 / 박(진료)구윤 3가지
          조합을 만들 수 있습니다.
        </p>
      </div>
    </div>
  )
}
