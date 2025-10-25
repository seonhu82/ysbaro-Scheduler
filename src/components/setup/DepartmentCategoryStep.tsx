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
import { Plus, X, GripVertical } from 'lucide-react'

interface DepartmentCategoryStepProps {
  departments: { name: string; order: number; useAutoAssignment: boolean }[]
  categories: { name: string; priority: number; order: number; departmentName: string | null }[]
  onDepartmentsChange: (data: { name: string; order: number; useAutoAssignment: boolean }[]) => void
  onCategoriesChange: (
    data: { name: string; priority: number; order: number; departmentName: string | null }[]
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
        { name: newDepartment.trim(), order: departments.length, useAutoAssignment: true },
      ])
      setNewDepartment('')
    }
  }

  const removeDepartment = (index: number) => {
    onDepartmentsChange(departments.filter((_, i) => i !== index))
  }

  const toggleAutoAssignment = (index: number) => {
    const updated = [...departments]
    updated[index].useAutoAssignment = !updated[index].useAutoAssignment
    onDepartmentsChange(updated)
  }

  const addCategory = () => {
    if (newCategory.trim()) {
      onCategoriesChange([
        ...categories,
        {
          name: newCategory.trim(),
          priority: categories.length + 1,
          order: categories.length,
          departmentName: null,
        },
      ])
      setNewCategory('')
    }
  }

  const updateCategoryDepartment = (index: number, departmentName: string | null) => {
    const updated = [...categories]
    updated[index].departmentName = departmentName
    onCategoriesChange(updated)
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`auto-${index}`}
                    checked={dept.useAutoAssignment}
                    onCheckedChange={() => toggleAutoAssignment(index)}
                  />
                  <Label
                    htmlFor={`auto-${index}`}
                    className="text-xs cursor-pointer text-gray-600"
                  >
                    자동배치
                  </Label>
                </div>
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
              구분 (직원 역할/등급)
            </Label>
            <p className="text-sm text-gray-600 mt-1">
              직원의 역할이나 등급을 구분합니다 (예: 팀장, 고년차, 중간년차)
            </p>
          </div>

          <div className="space-y-2">
            {categories.map((cat, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{cat.name}</span>
                  </div>
                  <Select
                    value={cat.departmentName || 'none'}
                    onValueChange={(value) =>
                      updateCategoryDepartment(index, value === 'none' ? null : value)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="부서 선택 (선택사항)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">부서 없음 (공통)</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.name} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
        <p className="text-sm text-blue-900">
          💡 <strong>안내:</strong>
        </p>
        <ul className="text-sm text-blue-900 space-y-1 ml-4 list-disc">
          <li>각 구분에 부서를 지정하면, 해당 부서에서만 사용됩니다.</li>
          <li>"부서 없음 (공통)"을 선택하면 모든 부서에서 사용 가능합니다.</li>
          <li>유연배치 시 같은 부서의 구분만 선택 가능합니다.</li>
          <li>각 구분별로 필요 인원은 5단계(의사 조합 설정)에서 비율로 지정합니다.</li>
        </ul>
      </div>
    </div>
  )
}
