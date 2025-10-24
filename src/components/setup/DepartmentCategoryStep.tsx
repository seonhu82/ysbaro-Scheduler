'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Plus, X, GripVertical } from 'lucide-react'

interface DepartmentCategoryStepProps {
  departments: { name: string; order: number }[]
  categories: { name: string; priority: number; order: number }[]
  onDepartmentsChange: (data: { name: string; order: number }[]) => void
  onCategoriesChange: (
    data: { name: string; priority: number; order: number }[]
  ) => void
}

export function DepartmentCategoryStep({
  departments,
  categories,
  onDepartmentsChange,
  onCategoriesChange,
}: DepartmentCategoryStepProps) {
  const [newDepartment, setNewDepartment] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const addDepartment = () => {
    if (newDepartment.trim()) {
      onDepartmentsChange([
        ...departments,
        { name: newDepartment.trim(), order: departments.length },
      ])
      setNewDepartment('')
    }
  }

  const removeDepartment = (index: number) => {
    onDepartmentsChange(departments.filter((_, i) => i !== index))
  }

  const addCategory = () => {
    if (newCategory.trim()) {
      onCategoriesChange([
        ...categories,
        {
          name: newCategory.trim(),
          priority: categories.length + 1,
          order: categories.length,
        },
      ])
      setNewCategory('')
    }
  }

  const removeCategory = (index: number) => {
    onCategoriesChange(categories.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          부서 및 구분 설정
        </h2>
        <p className="text-gray-600">
          직원 관리를 위한 부서와 구분을 설정해주세요
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* 부서 설정 */}
        <div className="space-y-4">
          <div>
            <Label className="text-lg font-semibold">부서</Label>
            <p className="text-sm text-gray-600 mt-1">
              직원이 소속될 부서를 설정합니다
            </p>
          </div>

          <div className="space-y-2">
            {departments.map((dept, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
                <span className="flex-1 font-medium">{dept.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDepartment(index)}
                  className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              placeholder="부서명 입력"
              onKeyPress={(e) => e.key === 'Enter' && addDepartment()}
              className="h-10"
            />
            <Button
              onClick={addDepartment}
              size="sm"
              className="h-10 px-4 bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-1" />
              추가
            </Button>
          </div>
        </div>

        {/* 구분 설정 */}
        <div className="space-y-4">
          <div>
            <Label className="text-lg font-semibold">
              구분 (스케줄 배치용)
            </Label>
            <p className="text-sm text-gray-600 mt-1">
              스케줄 배치 시 우선순위로 사용됩니다
            </p>
          </div>

          <div className="space-y-2">
            {categories.map((cat, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
                <div className="flex-1">
                  <span className="font-medium">{cat.name}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    (우선순위: {cat.priority})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCategory(index)}
                  className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="구분명 입력"
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
              className="h-10"
            />
            <Button
              onClick={addCategory}
              size="sm"
              className="h-10 px-4 bg-blue-600"
            >
              <Plus className="w-4 h-4 mr-1" />
              추가
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-900">
          💡 <strong>안내:</strong> 구분의 우선순위는 위에서 아래 순서로
          적용됩니다. 드래그하여 순서를 변경할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
