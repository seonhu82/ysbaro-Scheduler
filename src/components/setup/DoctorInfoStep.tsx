'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, X, UserCircle } from 'lucide-react'

interface Doctor {
  name: string
  useCategory: boolean
  categories: string[]
}

interface DoctorInfoStepProps {
  data: Doctor[]
  onChange: (data: Doctor[]) => void
}

export function DoctorInfoStep({ data, onChange }: DoctorInfoStepProps) {
  const [newDoctorName, setNewDoctorName] = useState('')

  const addDoctor = () => {
    if (newDoctorName.trim()) {
      onChange([
        ...data,
        {
          name: newDoctorName.trim(),
          useCategory: false,
          categories: [],
        },
      ])
      setNewDoctorName('')
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

  const addCategory = (doctorIndex: number, categoryName: string) => {
    if (categoryName.trim()) {
      const updated = [...data]
      updated[doctorIndex].categories.push(categoryName.trim())
      onChange(updated)
    }
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
              <div className="flex items-center gap-3">
                <UserCircle className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-lg">{doctor.name}</h3>
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
                    <span className="flex-1 text-sm">{category}</span>
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

                <div className="flex gap-2">
                  <Input
                    placeholder="구분 입력 (예: 상담)"
                    className="h-8 text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement
                        addCategory(doctorIndex, target.value)
                        target.value = ''
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement
                      addCategory(doctorIndex, input.value)
                      input.value = ''
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
      <div className="flex gap-2">
        <Input
          value={newDoctorName}
          onChange={(e) => setNewDoctorName(e.target.value)}
          placeholder="원장 이름 입력"
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
        <p className="text-sm text-blue-900">
          💡 <strong>안내:</strong> 구분은 한 원장이 상담과 진료를 모두 하는
          경우에만 사용합니다. (예: 박원장-상담, 박원장-진료)
        </p>
      </div>
    </div>
  )
}
