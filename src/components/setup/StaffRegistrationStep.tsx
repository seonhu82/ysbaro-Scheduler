'use client'

import { useState, useRef, useEffect } from 'react'
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
import { Plus, X, Users, Upload, Download, AlertCircle, Trash2, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { calculateAnnualLeave, formatYearsOfService } from '@/lib/utils/annual-leave-calculator'

interface Staff {
  name: string
  birthDate: string
  hireDate: string | null
  departmentName: string
  categoryName: string
  position: string
  workType: 'WEEK_4' | 'WEEK_5'
  flexibleForCategories: string[]
  totalAnnualDays: number
  usedAnnualDays: number
}

interface Position {
  id: string
  name: string
}

interface StaffRegistrationStepProps {
  data: Staff[]
  departments: { name: string; order: number }[]
  categories: { name: string; priority: number; order: number; departmentName: string | null }[]
  positions?: Position[]
  onChange: (data: Staff[]) => void
}

export function StaffRegistrationStep({
  data,
  departments,
  categories,
  positions = [],
  onChange,
}: StaffRegistrationStepProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL')
  const [filterCategory, setFilterCategory] = useState<string>('ALL')
  const [searchName, setSearchName] = useState<string>('')
  const [defaultAnnualDays, setDefaultAnnualDays] = useState<number>(15)
  const [newStaff, setNewStaff] = useState<Staff>({
    name: '',
    birthDate: '',
    hireDate: null,
    departmentName: departments[0]?.name || '',
    categoryName: 'none', // 선택 사항 (none으로 시작)
    position: '사원',
    workType: 'WEEK_4',
    flexibleForCategories: [],
    totalAnnualDays: 15,
    usedAnnualDays: 0,
  })

  // 전체 선택 상태 업데이트
  useEffect(() => {
    setSelectAll(data.length > 0 && selectedIndices.length === data.length)
  }, [selectedIndices, data.length])

  // 부서/구분 데이터 로그
  useEffect(() => {
    console.log('StaffRegistrationStep - departments:', departments.length, departments)
    console.log('StaffRegistrationStep - categories:', categories.length, categories)
  }, [departments, categories])

  // 규칙 설정에서 기본 연차 일수 가져오기
  useEffect(() => {
    const fetchRuleSettings = async () => {
      try {
        const response = await fetch('/api/settings/rules')
        const data = await response.json()
        if (data.success && data.data) {
          const annualDays = data.data.defaultAnnualDays || 15
          setDefaultAnnualDays(annualDays)
          // newStaff 초기값도 업데이트
          setNewStaff(prev => ({
            ...prev,
            totalAnnualDays: annualDays
          }))
        }
      } catch (error) {
        console.error('규칙 설정 로드 실패:', error)
        // 실패 시 법정 기본값 15일 사용
        setDefaultAnnualDays(15)
      }
    }
    fetchRuleSettings()
  }, [])

  const addStaff = () => {
    if (newStaff.name.trim() && newStaff.birthDate.length === 6) {
      // categoryName이 'none'이면 빈 문자열로 저장
      const staffToAdd = {
        ...newStaff,
        categoryName: newStaff.categoryName === 'none' ? '' : newStaff.categoryName
      }
      onChange([...data, staffToAdd])
      setNewStaff({
        name: '',
        birthDate: '',
        hireDate: null,
        departmentName: departments[0]?.name || '',
        categoryName: 'none', // 초기화 시 'none'
        position: '사원',
        workType: 'WEEK_4',
        flexibleForCategories: [],
        totalAnnualDays: defaultAnnualDays, // 규칙 설정의 기본값 사용
        usedAnnualDays: 0,
      })
    }
  }

  const toggleFlexibleCategory = (staffIndex: number, categoryName: string) => {
    const updated = [...data]
    const staff = updated[staffIndex]

    // flexibleForCategories가 없으면 빈 배열로 초기화
    if (!staff.flexibleForCategories) {
      staff.flexibleForCategories = []
    }

    if (staff.flexibleForCategories.includes(categoryName)) {
      staff.flexibleForCategories = staff.flexibleForCategories.filter(c => c !== categoryName)
    } else {
      staff.flexibleForCategories = [...staff.flexibleForCategories, categoryName]
    }

    onChange(updated)
  }

  const updateStaffField = (staffIndex: number, field: keyof Staff, value: any) => {
    const updated = [...data]
    updated[staffIndex] = { ...updated[staffIndex], [field]: value }
    onChange(updated)
  }

  const removeStaff = (index: number) => {
    onChange(data.filter((_, i) => i !== index))
    setSelectedIndices(selectedIndices.filter((i) => i !== index))
  }

  const removeSelectedStaff = () => {
    if (selectedIndices.length === 0) return

    const confirmed = window.confirm(
      `선택한 ${selectedIndices.length}명의 직원을 삭제하시겠습니까?`
    )

    if (confirmed) {
      onChange(data.filter((_, index) => !selectedIndices.includes(index)))
      setSelectedIndices([])
    }
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIndices([])
    } else {
      setSelectedIndices(data.map((_, index) => index))
    }
  }

  const toggleSelection = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index))
    } else {
      setSelectedIndices([...selectedIndices, index])
    }
  }

  const applyWorkTypeToSelected = (workType: 'WEEK_4' | 'WEEK_5') => {
    const updated = data.map((staff, index) =>
      selectedIndices.includes(index) ? { ...staff, workType } : staff
    )
    onChange(updated)
    setSelectedIndices([])
  }

  // 엑셀 템플릿 다운로드
  const downloadTemplate = () => {
    const templateData = [
      {
        이름: '홍길동',
        생년월일: '950101',
        입사일: '2020-01-15',
        부서: departments[0]?.name || '',
        구분: categories[0]?.name || '',
        직급: '사원',
        근무형태: '주4일',
        총연차: 15,
        사용연차: 3,
        유연배치구분: '',
      },
      {
        이름: '김철수',
        생년월일: '960215',
        입사일: '2018-03-20',
        부서: departments[0]?.name || '',
        구분: categories[1]?.name || '',
        직급: '대리',
        근무형태: '주5일',
        총연차: 15,
        사용연차: 5,
        유연배치구분: categories[0]?.name + ',' + (categories[2]?.name || ''),
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '직원목록')

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 10 }, // 이름
      { wch: 12 }, // 생년월일
      { wch: 12 }, // 입사일
      { wch: 15 }, // 부서
      { wch: 15 }, // 구분
      { wch: 10 }, // 직급
      { wch: 10 }, // 근무형태
      { wch: 10 }, // 총연차
      { wch: 10 }, // 사용연차
      { wch: 20 }, // 유연배치구분
    ]

    XLSX.writeFile(wb, '직원등록_템플릿.xlsx')
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

        const newStaffList: Staff[] = []
        const errors: string[] = []

        jsonData.forEach((row, index) => {
          const rowNum = index + 2 // 엑셀 행 번호 (헤더 제외)

          // 필수 필드 검증
          if (!row['이름']) {
            errors.push(`${rowNum}행: 이름이 누락되었습니다.`)
            return
          }

          if (!row['생년월일']) {
            errors.push(`${rowNum}행: 생년월일이 누락되었습니다.`)
            return
          }

          // 생년월일 형식 검증 및 변환
          let birthDate = String(row['생년월일']).replace(/\D/g, '')
          if (birthDate.length === 8) {
            // YYYYMMDD 형식인 경우 YYMMDD로 변환
            birthDate = birthDate.substring(2)
          }
          if (birthDate.length !== 6) {
            errors.push(`${rowNum}행: 생년월일 형식이 올바르지 않습니다. (YYMMDD 6자리 필요)`)
            return
          }

          // 부서 검증
          const deptName = row['부서'] || departments[0]?.name
          if (!departments.find((d) => d.name === deptName)) {
            errors.push(`${rowNum}행: 존재하지 않는 부서입니다. (${deptName})`)
            return
          }

          // 구분 검증 (빈 값 허용)
          const catName = row['구분'] ? String(row['구분']).trim() : ''
          if (catName && !categories.find((c) => c.name === catName)) {
            errors.push(`${rowNum}행: 존재하지 않는 구분입니다. (${catName})`)
            return
          }

          // 직급
          const position = row['직급'] || '사원'

          // 근무형태 변환
          let workType: 'WEEK_4' | 'WEEK_5' = 'WEEK_4'
          const workTypeStr = String(row['근무형태'] || '주4일')
          if (workTypeStr.includes('5') || workTypeStr.includes('5일')) {
            workType = 'WEEK_5'
          }

          // 유연 배치 구분 파싱 (예: "고년차,중간년차" 또는 비어있음)
          const flexibleStr = row['유연배치구분'] || ''
          const flexibleCategoriesRaw = flexibleStr
            ? String(flexibleStr).split(',').map((s: string) => s.trim()).filter(Boolean)
            : []

          // 유연배치 구분 필터링: 같은 부서 또는 공통 구분만 허용
          const flexibleForCategories = flexibleCategoriesRaw.filter(flexCatName => {
            const flexCat = categories.find(c => c.name === flexCatName)
            if (!flexCat) return false // 존재하지 않는 구분
            if (flexCat.name === catName) return false // 자신의 구분 제외
            if (flexCat.departmentName === null) return true // 공통 구분은 허용
            return flexCat.departmentName === deptName // 같은 부서만 허용
          })

          // 입사일 처리
          let hireDate: string | null = null
          if (row['입사일']) {
            const hireDateStr = String(row['입사일']).trim()
            // YYYY-MM-DD 형식으로 변환
            if (hireDateStr) {
              // 엑셀 날짜 숫자를 Date로 변환하거나 문자열 그대로 사용
              if (!isNaN(Number(hireDateStr))) {
                // 엑셀 날짜 숫자 (1900-01-01부터의 일수)
                const excelEpoch = new Date(1899, 11, 30)
                const date = new Date(excelEpoch.getTime() + Number(hireDateStr) * 86400000)
                hireDate = date.toISOString().split('T')[0]
              } else {
                // 문자열 형태의 날짜
                hireDate = hireDateStr.includes('-') ? hireDateStr : null
              }
            }
          }

          // 연차 정보 (입사일이 있으면 자동 계산, 없으면 입력값 사용)
          let totalAnnualDays = row['총연차'] ? Number(row['총연차']) : 15
          if (hireDate) {
            totalAnnualDays = calculateAnnualLeave(new Date(hireDate))
          }
          const usedAnnualDays = row['사용연차'] ? Number(row['사용연차']) : 0

          newStaffList.push({
            name: String(row['이름']).trim(),
            birthDate,
            hireDate,
            departmentName: deptName,
            categoryName: catName,
            position: String(position).trim(),
            workType,
            flexibleForCategories,
            totalAnnualDays,
            usedAnnualDays,
          })
        })

        if (errors.length > 0) {
          setUploadError(errors.join('\n'))
          return
        }

        // 기존 데이터에 추가
        onChange([...data, ...newStaffList])

        // 성공 메시지
        alert(`${newStaffList.length}명의 직원이 추가되었습니다.`)

        // 파일 입력 초기화
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">직원 등록</h2>
        <p className="text-gray-600">
          직원 정보를 입력하고 근무 형태를 설정해주세요
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
                여러 명의 직원을 한 번에 등록할 수 있습니다
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

      {/* 직원 목록 테이블 */}
      {data.length > 0 && (
        <div className="space-y-3">
          {/* 필터 및 검색 */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1">이름 검색</Label>
                <Input
                  placeholder="이름으로 검색..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1">부서 필터</Label>
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체</SelectItem>
                    {Array.from(new Set(data.map(s => s.departmentName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')).map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1">구분 필터</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">전체</SelectItem>
                    {Array.from(new Set(data.map(s => s.categoryName).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko')).map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', minWidth: '1400px' }}>
              <colgroup>
                <col style={{ width: '4%' }} /> {/* 전체선택 */}
                <col style={{ width: '6%' }} /> {/* 이름 */}
                <col style={{ width: '7%' }} /> {/* 생년월일 */}
                <col style={{ width: '8%' }} /> {/* 입사일 */}
                <col style={{ width: '9%' }} /> {/* 부서 */}
                <col style={{ width: '11%' }} /> {/* 구분 */}
                <col style={{ width: '6%' }} /> {/* 직급 */}
                <col style={{ width: '9%' }} /> {/* 근무형태 */}
                <col style={{ width: '13%' }} /> {/* 남은연차 */}
                <col style={{ width: '22%' }} /> {/* 유연배치 */}
                <col style={{ width: '5%' }} /> {/* 삭제 */}
              </colgroup>
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-2 py-3 text-left">
                    <div className="flex items-center gap-1">
                      <Checkbox
                        checked={selectAll}
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        선택
                      </span>
                    </div>
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    이름
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    생년월일
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    입사일
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    부서
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    구분
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    직급
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    근무형태
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    남은연차
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    유연배치
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    삭제
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y">
                {(() => {
                  // 필터링 및 정렬
                  let filteredData = data.filter((staff, index) => {
                    // 이름 검색
                    if (searchName && !staff.name.toLowerCase().includes(searchName.toLowerCase())) {
                      return false
                    }
                    // 부서 필터
                    if (filterDepartment !== 'ALL' && staff.departmentName !== filterDepartment) {
                      return false
                    }
                    // 구분 필터
                    if (filterCategory !== 'ALL' && staff.categoryName !== filterCategory) {
                      return false
                    }
                    return true
                  })

                  // 정렬: 부서 → 구분 → 이름
                  filteredData = filteredData.sort((a, b) => {
                    if ((a.departmentName || '') !== (b.departmentName || '')) {
                      return (a.departmentName || '').localeCompare(b.departmentName || '', 'ko')
                    }
                    if ((a.categoryName || '') !== (b.categoryName || '')) {
                      return (a.categoryName || '').localeCompare(b.categoryName || '', 'ko')
                    }
                    return (a.name || '').localeCompare(b.name || '', 'ko')
                  })

                  // 원본 인덱스 매핑 생성
                  const indexMap = new Map<number, number>()
                  filteredData.forEach((staff) => {
                    const originalIndex = data.findIndex((s, i) =>
                      s.name === staff.name &&
                      s.birthDate === staff.birthDate &&
                      s.departmentName === staff.departmentName
                    )
                    indexMap.set(data.indexOf(staff), originalIndex)
                  })

                  return filteredData.map((staff, displayIndex) => {
                    const originalIndex = data.findIndex((s, i) =>
                      s.name === staff.name &&
                      s.birthDate === staff.birthDate &&
                      s.departmentName === staff.departmentName
                    )
                    const index = originalIndex

                    return (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-2 py-3">
                    <Checkbox
                      checked={selectedIndices.includes(index)}
                      onCheckedChange={() => toggleSelection(index)}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <Input
                      value={staff.name}
                      onChange={(e) => updateStaffField(index, 'name', e.target.value)}
                      className="h-8 text-sm font-medium"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <Input
                      value={staff.birthDate}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                        updateStaffField(index, 'birthDate', value)
                      }}
                      maxLength={6}
                      placeholder="YYMMDD"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-2 py-3">
                    <div className="space-y-1">
                      <Input
                        type="date"
                        value={staff.hireDate || ''}
                        onChange={(e) => {
                          const newHireDate = e.target.value

                          // 입사일이 입력되면 자동으로 연차 계산, 비우면 기본값 사용
                          if (newHireDate) {
                            const calculatedAnnual = calculateAnnualLeave(new Date(newHireDate))
                            updateStaffField(index, 'hireDate', newHireDate)
                            updateStaffField(index, 'totalAnnualDays', calculatedAnnual)
                          } else {
                            // 입사일이 비어있으면 기본 연차 사용
                            updateStaffField(index, 'hireDate', null)
                            updateStaffField(index, 'totalAnnualDays', defaultAnnualDays)
                          }
                        }}
                        className="h-8 text-xs"
                      />
                      {staff.hireDate && (
                        <span className="text-[10px] text-blue-600 block">
                          {formatYearsOfService(new Date(staff.hireDate))}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <Select
                      value={staff.departmentName}
                      onValueChange={(value) => updateStaffField(index, 'departmentName', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.name} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-3">
                    <Select
                      value={staff.categoryName || 'none'}
                      onValueChange={(value) => updateStaffField(index, 'categoryName', value === 'none' ? '' : value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">없음</SelectItem>
                        {categories
                          .filter(cat => {
                            if (cat.departmentName === null) return true
                            return cat.departmentName === staff.departmentName
                          })
                          .map((cat) => (
                            <SelectItem key={cat.name} value={cat.name}>
                              {cat.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-3">
                    <Input
                      list="position-list-table"
                      value={staff.position}
                      onChange={(e) => updateStaffField(index, 'position', e.target.value)}
                      className="h-8 text-sm"
                      placeholder="선택 또는 입력"
                    />
                    <datalist id="position-list-table">
                      {(positions || []).map((pos) => (
                        <option key={pos.id} value={pos.name} />
                      ))}
                    </datalist>
                  </td>
                  <td className="px-2 py-3">
                    <Select
                      value={staff.workType}
                      onValueChange={(value: 'WEEK_4' | 'WEEK_5') => updateStaffField(index, 'workType', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WEEK_4">주4일</SelectItem>
                        <SelectItem value="WEEK_5">주5일</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-blue-600 min-w-[24px] text-center">
                        {staff.totalAnnualDays || defaultAnnualDays}
                      </span>
                      <span className="text-xs text-gray-500">-</span>
                      <Input
                        type="number"
                        min="0"
                        max={staff.totalAnnualDays || defaultAnnualDays}
                        value={staff.usedAnnualDays || 0}
                        onChange={(e) => updateStaffField(index, 'usedAnnualDays', parseInt(e.target.value) || 0)}
                        className="h-8 w-14 text-sm"
                        title="사용 연차"
                        placeholder="0"
                      />
                      <span className="text-xs font-medium text-green-700 ml-1 whitespace-nowrap">
                        = {(staff.totalAnnualDays || defaultAnnualDays) - (staff.usedAnnualDays || 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-2">
                      {(() => {
                        // 같은 부서의 구분만 표시 (자신의 구분 제외)
                        const availableCategories = categories.filter(cat => {
                          // 자신의 구분 제외
                          if (cat.name === staff.categoryName) return false
                          // 부서가 없는 구분(공통)은 모든 부서에서 사용 가능
                          if (cat.departmentName === null) return true
                          // 같은 부서의 구분만
                          return cat.departmentName === staff.departmentName
                        })

                        return (
                          <>
                            {availableCategories.length > 0 ? (
                              <>
                                <div className="flex flex-wrap gap-1">
                                  {availableCategories.map((cat) => (
                                    <button
                                      key={cat.name}
                                      onClick={() => toggleFlexibleCategory(index, cat.name)}
                                      className={`px-2 py-1 text-xs rounded transition-colors ${
                                        (staff.flexibleForCategories || []).includes(cat.name)
                                          ? 'bg-orange-100 text-orange-700 border border-orange-300 font-medium'
                                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                      }`}
                                      title={`클릭하여 ${cat.name} 유연배치 ${(staff.flexibleForCategories || []).includes(cat.name) ? '해제' : '설정'}`}
                                    >
                                      {cat.name}
                                    </button>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div className="text-xs text-gray-400 italic">
                                -
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStaff(index)}
                      className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 직원 추가 폼 */}
      <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">새 직원 추가</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">이름 *</Label>
            <Input
              value={newStaff.name}
              onChange={(e) =>
                setNewStaff({ ...newStaff, name: e.target.value })
              }
              placeholder="홍길동"
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">생년월일 (YYMMDD) *</Label>
            <Input
              value={newStaff.birthDate}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setNewStaff({ ...newStaff, birthDate: value })
              }}
              placeholder="950101"
              maxLength={6}
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">부서</Label>
            <Select
              value={newStaff.departmentName}
              onValueChange={(value) =>
                setNewStaff({
                  ...newStaff,
                  departmentName: value,
                  categoryName: 'none' // 부서 변경 시 구분 초기화
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.name} value={dept.name}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">구분 (선택사항)</Label>
            <Select
              value={newStaff.categoryName}
              onValueChange={(value) =>
                setNewStaff({ ...newStaff, categoryName: value })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="선택안함" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택안함</SelectItem>
                {categories
                  .filter(cat => {
                    // 선택한 부서의 구분만 표시 (공통 구분도 포함)
                    if (cat.departmentName === null) return true // 공통 구분
                    return cat.departmentName === newStaff.departmentName
                  })
                  .map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">직급</Label>
            <Input
              list="position-list-new"
              value={newStaff.position}
              onChange={(e) =>
                setNewStaff({ ...newStaff, position: e.target.value })
              }
              placeholder="직급 선택 또는 입력"
              className="h-9"
            />
            <datalist id="position-list-new">
              {(positions || []).map((pos) => (
                <option key={pos.id} value={pos.name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">근무형태</Label>
            <div className="flex gap-2 items-center h-9">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={newStaff.workType === 'WEEK_4'}
                  onChange={() =>
                    setNewStaff({ ...newStaff, workType: 'WEEK_4' })
                  }
                  className="w-3 h-3"
                />
                <span className="text-sm">주4일</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={newStaff.workType === 'WEEK_5'}
                  onChange={() =>
                    setNewStaff({ ...newStaff, workType: 'WEEK_5' })
                  }
                  className="w-3 h-3"
                />
                <span className="text-sm">주5일</span>
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">총 연차</Label>
            <Input
              type="number"
              min="0"
              max="30"
              value={newStaff.totalAnnualDays}
              onChange={(e) =>
                setNewStaff({ ...newStaff, totalAnnualDays: parseInt(e.target.value) || 0 })
              }
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">사용 연차</Label>
            <Input
              type="number"
              min="0"
              max={newStaff.totalAnnualDays}
              value={newStaff.usedAnnualDays}
              onChange={(e) =>
                setNewStaff({ ...newStaff, usedAnnualDays: parseInt(e.target.value) || 0 })
              }
              className="h-9"
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={addStaff}
              disabled={!newStaff.name.trim() || newStaff.birthDate.length !== 6}
              className="h-9 w-full bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-1" />
              추가
            </Button>
          </div>
        </div>

        {/* 유연배치 안내 */}
        <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <h4 className="font-semibold text-sm text-orange-900 mb-3">💡 유연배치 설정 가이드</h4>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-orange-900 mb-1">유연배치란?</p>
              <p className="text-xs text-orange-800">
                자신의 본래 구분 외에 다른 구분의 역할도 수행할 수 있는 직원을 설정합니다.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-orange-900 mb-1">설정 방법:</p>
              <ul className="text-xs text-orange-800 space-y-1 list-disc list-inside ml-2">
                <li>테이블에서 각 직원의 "유연배치" 열에서 가능한 구분 버튼을 클릭</li>
                <li>선택된 버튼이 주황색으로 표시됩니다</li>
              </ul>
            </div>

            <div className="p-3 bg-white rounded border border-orange-300">
              <p className="text-xs font-semibold text-orange-900 mb-1">🔄 작동 방식:</p>
              <ul className="text-xs text-orange-800 space-y-1 ml-2">
                <li>특정 구분의 인원이 부족할 때, 해당 구분을 유연배치로 설정한 직원이 자동 투입됩니다</li>
                <li className="mt-2 pt-2 border-t border-orange-200">
                  <span className="font-semibold">예시:</span> "팀장/실장" 자리가 부족할 때
                  <br/>→ 본래 "팀장/실장"인 직원을 먼저 배치
                  <br/>→ 부족하면 유연배치 가능한 직원 중 형평성 점수가 높은 순으로 배치
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-orange-900 mb-1">엑셀 업로드 시:</p>
              <ul className="text-xs text-orange-800 space-y-1 list-disc list-inside ml-2">
                <li><strong>유연배치구분</strong>: 쉼표로 구분 (예: "팀장/실장,고년차")</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 일괄 적용 */}
      {selectedIndices.length > 0 && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              선택한 {selectedIndices.length}명에게 일괄 적용:
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={removeSelectedStaff}
                className="h-8"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                선택 삭제
              </Button>
              <Button
                size="sm"
                onClick={() => applyWorkTypeToSelected('WEEK_4')}
                className="h-8 bg-green-600"
              >
                주4일로 변경
              </Button>
              <Button
                size="sm"
                onClick={() => applyWorkTypeToSelected('WEEK_5')}
                className="h-8 bg-amber-600"
              >
                주5일로 변경
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-3">
        <div>
          <p className="text-sm font-semibold text-blue-900 mb-2">
            💡 <strong>안내</strong>
          </p>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex gap-2">
              <span className="font-semibold min-w-[70px]">생년월일:</span>
              <span>최초 로그인 시 본인 확인용으로 사용됩니다. PIN 설정 후에는 PIN으로 로그인합니다. (YYMMDD 형식, 6자리)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold min-w-[70px]">입사일:</span>
              <span>근속연수에 따라 연차가 자동 계산됩니다. 입력하지 않으면 근무규칙에서 설정한 기본 연차(미설정 시 15일)가 적용됩니다.</span>
            </li>
          </ul>
        </div>
        <div className="pt-2 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            <strong>연차 자동 계산 (근로기준법):</strong> 1년 미만 월 1일, 1년 이상 15일, 3년 이상 2년마다 1일 가산 (최대 25일)
          </p>
        </div>
      </div>
    </div>
  )
}
