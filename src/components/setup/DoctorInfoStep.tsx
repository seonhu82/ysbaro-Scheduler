'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, X, UserCircle } from 'lucide-react'

interface Doctor {
  name: string
  shortName: string
  useCategory: boolean
  categories: Array<{
    name: string
    shortName: string
  }>
}

interface DoctorInfoStepProps {
  data: Doctor[]
  onChange: (data: Doctor[]) => void
}

export function DoctorInfoStep({ data, onChange }: DoctorInfoStepProps) {
  const [newDoctorName, setNewDoctorName] = useState('')
  const [newDoctorShortName, setNewDoctorShortName] = useState('')

  const extractSurname = (name: string): string => {
    // 이름에서 성 추출 (첫 글자)
    return name.trim().charAt(0)
  }

  const addDoctor = () => {
    if (newDoctorName.trim()) {
      const surname = extractSurname(newDoctorName)
      const shortName = newDoctorShortName.trim() || surname

      onChange([
        ...data,
        {
          name: newDoctorName.trim(),
          shortName,
          useCategory: false,
          categories: [],
        },
      ])
      setNewDoctorName('')
      setNewDoctorShortName('')
    }
  }

  const removeDoctor = (index: number) => {
    onChange(data.filter((_, i) => i !== index))
  }

  const toggleUseCategory = (index: number) => {
    const updated = [...data]
    updated[index].useCategory = !updated[index].useCategory
    if (!updated[index].useCategory) {
      updated[index].categories = []
    }
    onChange(updated)
  }

  const addCategory = (doctorIndex: number, categoryName: string, categoryShortName: string) => {
    if (categoryName.trim()) {
      const updated = [...data]
      const doctor = updated[doctorIndex]
      const defaultShortName = `${doctor.shortName}(${categoryName.trim()})`

      updated[doctorIndex].categories.push({
        name: categoryName.trim(),
        shortName: categoryShortName.trim() || defaultShortName
      })
      onChange(updated)
    }
  }

  const updateDoctorShortName = (index: number, shortName: string) => {
    const updated = [...data]
    updated[index].shortName = shortName
    onChange(updated)
  }

  const updateCategoryShortName = (doctorIndex: number, categoryIndex: number, shortName: string) => {
    const updated = [...data]
    updated[doctorIndex].categories[categoryIndex].shortName = shortName
    onChange(updated)
  }

  const removeCategory = (doctorIndex: number, categoryIndex: number) => {
    const updated = [...data]
    updated[doctorIndex].categories = updated[doctorIndex].categories.filter(
      (_, i) => i !== categoryIndex
    )
    onChange(updated)
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          원장 정보 설정
        </h2>
        <p className="text-gray-600">
          원장 정보와 필요한 경우 구분을 설정해주세요
        </p>
      </div>

      <div className="space-y-4">
        {data.map((doctor, doctorIndex) => (
          <div
            key={doctorIndex}
            className="p-5 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 flex-1">
                <UserCircle className="w-6 h-6 text-blue-600" />
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">원장명</Label>
                    <h3 className="font-semibold text-lg">{doctor.name}</h3>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">별칭 (조합명용)</Label>
                    <Input
                      value={doctor.shortName}
                      onChange={(e) => updateDoctorShortName(doctorIndex, e.target.value)}
                      placeholder="예: 박, 황"
                      className="h-8 mt-1"
                    />
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeDoctor(doctorIndex)}
                className="hover:bg-red-100 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* 구분 사용 체크박스 */}
            <div className="flex items-center space-x-2 mb-3">
              <Checkbox
                id={`use-category-${doctorIndex}`}
                checked={doctor.useCategory}
                onCheckedChange={() => toggleUseCategory(doctorIndex)}
              />
              <Label
                htmlFor={`use-category-${doctorIndex}`}
                className="text-sm font-medium cursor-pointer"
              >
                구분 사용 (예: 상담, 진료)
              </Label>
            </div>

            {/* 구분 목록 */}
            {doctor.useCategory && (
              <div className="ml-6 space-y-2">
                {doctor.categories.map((category, categoryIndex) => (
                  <div
                    key={categoryIndex}
                    className="flex items-center gap-2 p-2 bg-white rounded border"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <span className="text-sm">{category.name}</span>
                      <Input
                        value={category.shortName}
                        onChange={(e) => updateCategoryShortName(doctorIndex, categoryIndex, e.target.value)}
                        placeholder="별칭"
                        className="h-7 text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCategory(doctorIndex, categoryIndex)}
                      className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}

                <div className="grid grid-cols-[1fr,1fr,auto] gap-2">
                  <Input
                    id={`category-name-${doctorIndex}`}
                    placeholder="구분 입력 (예: 상담)"
                    className="h-8 text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const nameInput = e.target as HTMLInputElement
                        const shortInput = document.getElementById(`category-short-${doctorIndex}`) as HTMLInputElement
                        addCategory(doctorIndex, nameInput.value, shortInput?.value || '')
                        nameInput.value = ''
                        if (shortInput) shortInput.value = ''
                      }
                    }}
                  />
                  <Input
                    id={`category-short-${doctorIndex}`}
                    placeholder="별칭 (예: 박(상담))"
                    className="h-8 text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const nameInput = document.getElementById(`category-name-${doctorIndex}`) as HTMLInputElement
                        const shortInput = e.target as HTMLInputElement
                        addCategory(doctorIndex, nameInput?.value || '', shortInput.value)
                        if (nameInput) nameInput.value = ''
                        shortInput.value = ''
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const nameInput = document.getElementById(`category-name-${doctorIndex}`) as HTMLInputElement
                      const shortInput = document.getElementById(`category-short-${doctorIndex}`) as HTMLInputElement
                      addCategory(doctorIndex, nameInput?.value || '', shortInput?.value || '')
                      if (nameInput) nameInput.value = ''
                      if (shortInput) shortInput.value = ''
                    }}
                    className="h-8 px-3 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    추가
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 원장 추가 */}
      <div className="grid grid-cols-[2fr,1fr,auto] gap-2">
        <Input
          value={newDoctorName}
          onChange={(e) => {
            setNewDoctorName(e.target.value)
            // 자동으로 성 추출
            if (e.target.value && !newDoctorShortName) {
              setNewDoctorShortName(extractSurname(e.target.value))
            }
          }}
          placeholder="원장 이름 입력"
          onKeyPress={(e) => e.key === 'Enter' && addDoctor()}
          className="h-11"
        />
        <Input
          value={newDoctorShortName}
          onChange={(e) => setNewDoctorShortName(e.target.value)}
          placeholder="별칭 (자동)"
          onKeyPress={(e) => e.key === 'Enter' && addDoctor()}
          className="h-11"
        />
        <Button
          onClick={addDoctor}
          className="h-11 px-6 bg-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          원장 추가
        </Button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-900 mb-2">
          💡 <strong>안내:</strong>
        </p>
        <ul className="text-sm text-blue-900 space-y-1 ml-4">
          <li>• <strong>별칭</strong>은 의사 조합명에 사용됩니다 (예: 박창범 → 박)</li>
          <li>• 성이 같은 경우 다른 별칭을 사용하세요 (예: 박효진 → 효)</li>
          <li>• <strong>구분</strong>은 한 원장이 상담과 진료를 모두 하는 경우에만 사용합니다</li>
        </ul>
      </div>
    </div>
  )
}
