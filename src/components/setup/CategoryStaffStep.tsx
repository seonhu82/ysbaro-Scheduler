'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar, RefreshCw } from 'lucide-react'

interface Combination {
  name: string
  dayOfWeek: string
  requiredStaff: number
  departmentRequiredStaff: { [departmentName: string]: number }
  departmentCategoryStaff?: {
    [departmentName: string]: {
      [categoryName: string]: {
        count: number
        minRequired: number
      }
    }
  }
  doctors: string[]
  hasNightShift: boolean
}

interface Staff {
  name: string
  birthDate: string
  departmentName: string
  categoryName: string
  position: string
  workType: 'WEEK_4' | 'WEEK_5'
  flexibleForCategories: string[]
  flexibilityPriority: number
}

interface CategoryStaffStepProps {
  combinations: Combination[]
  staff: Staff[]
  categories: string[]
  onChange: (data: Combination[]) => void
}

const DAYS_OF_WEEK_MAP: { [key: string]: string } = {
  MONDAY: '월요일',
  TUESDAY: '화요일',
  WEDNESDAY: '수요일',
  THURSDAY: '목요일',
  FRIDAY: '금요일',
  SATURDAY: '토요일',
  SUNDAY: '일요일',
}

export function CategoryStaffStep({
  combinations,
  staff,
  categories,
  onChange,
}: CategoryStaffStepProps) {

  // 부서별 구분별 기본 인원 계산 (현재 직원 비율 기반)
  const calculateDepartmentCategoryStaff = (
    departmentRequiredStaff: { [departmentName: string]: number }
  ) => {
    const result: Combination['departmentCategoryStaff'] = {}

    Object.entries(departmentRequiredStaff).forEach(([deptName, deptRequired]) => {
      if (deptRequired === 0) return

      // 이 부서의 직원들만 필터링
      const deptStaff = staff.filter(
        (s) => s.departmentName === deptName && s.categoryName
      )

      if (deptStaff.length === 0) {
        result[deptName] = {}
        return
      }

      // 구분별 현재 인원 수 계산
      const categoryCount: { [cat: string]: number } = {}
      deptStaff.forEach((s) => {
        categoryCount[s.categoryName] =
          (categoryCount[s.categoryName] || 0) + 1
      })

      // 비율로 필요 인원 배분
      const totalStaff = deptStaff.length
      result[deptName] = {}

      Object.entries(categoryCount).forEach(([catName, count]) => {
        const ratio = count / totalStaff
        const allocatedCount = Math.round(deptRequired * ratio)

        if (allocatedCount > 0) {
          result[deptName]![catName] = {
            count: allocatedCount,
            minRequired: 0, // 기본적으로 필수 아님
          }
        }
      })
    })

    return result
  }

  // 자동 계산 버튼 클릭
  const handleAutoCalculate = (index: number) => {
    const combination = combinations[index]
    const calculated = calculateDepartmentCategoryStaff(
      combination.departmentRequiredStaff
    )

    const updated = [...combinations]
    updated[index] = {
      ...combination,
      departmentCategoryStaff: calculated,
    }
    onChange(updated)
  }

  // 구분별 인원 수 변경
  const handleCountChange = (
    combIndex: number,
    deptName: string,
    catName: string,
    value: number
  ) => {
    const updated = [...combinations]
    const combination = updated[combIndex]

    if (!combination.departmentCategoryStaff) {
      combination.departmentCategoryStaff = {}
    }
    if (!combination.departmentCategoryStaff[deptName]) {
      combination.departmentCategoryStaff[deptName] = {}
    }

    const current =
      combination.departmentCategoryStaff[deptName][catName] || {
        count: 0,
        minRequired: 0,
      }

    combination.departmentCategoryStaff[deptName][catName] = {
      count: value,
      minRequired: Math.min(current.minRequired, value), // 필수 인원이 count를 초과하지 않도록
    }

    onChange(updated)
  }

  // 필수 인원 변경
  const handleMinRequiredChange = (
    combIndex: number,
    deptName: string,
    catName: string,
    value: number
  ) => {
    const updated = [...combinations]
    const combination = updated[combIndex]

    if (!combination.departmentCategoryStaff) {
      combination.departmentCategoryStaff = {}
    }
    if (!combination.departmentCategoryStaff[deptName]) {
      combination.departmentCategoryStaff[deptName] = {}
    }

    const current =
      combination.departmentCategoryStaff[deptName][catName] || {
        count: 0,
        minRequired: 0,
      }

    combination.departmentCategoryStaff[deptName][catName] = {
      ...current,
      minRequired: value,
    }

    onChange(updated)
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          구분별 인원 설정
        </h2>
        <p className="text-gray-600">
          각 조합별로 구분별 필요 인원과 필수 인원을 설정해주세요
        </p>
      </div>

      <div className="space-y-4">
        {combinations.map((combination, combIndex) => {
          const hasDeptStaff = Object.keys(
            combination.departmentRequiredStaff || {}
          ).some((dept) => (combination.departmentRequiredStaff[dept] || 0) > 0)

          if (!hasDeptStaff) {
            return (
              <div
                key={combIndex}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <h3 className="font-semibold">{combination.name}</h3>
                    <p className="text-sm text-gray-500">
                      {DAYS_OF_WEEK_MAP[combination.dayOfWeek]}
                    </p>
                  </div>
                  <span className="ml-auto text-xs text-gray-500 italic">
                    자동배치 사용 부서 없음
                  </span>
                </div>
              </div>
            )
          }

          return (
            <div
              key={combIndex}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              {/* 헤더 */}
              <div className="p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold">{combination.name}</h3>
                      <p className="text-sm text-gray-500">
                        {DAYS_OF_WEEK_MAP[combination.dayOfWeek]} •{' '}
                        {Object.entries(combination.departmentRequiredStaff)
                          .filter(([_, count]) => count > 0)
                          .map(([dept, count]) => `${dept} ${count}명`)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleAutoCalculate(combIndex)}
                    className="h-8 text-xs"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    자동 계산
                  </Button>
                </div>
              </div>

              {/* 내용 */}
              <div className="p-4 bg-white space-y-4">
                {Object.entries(combination.departmentRequiredStaff)
                    .filter(([_, count]) => count > 0)
                    .map(([deptName, deptRequired]) => {
                      // 이 부서의 직원들
                      const deptStaff = staff.filter(
                        (s) =>
                          s.departmentName === deptName && s.categoryName
                      )

                      // 이 부서에 해당하는 구분들
                      const deptCategories = Array.from(
                        new Set(deptStaff.map((s) => s.categoryName))
                      )

                      if (deptCategories.length === 0) {
                        return (
                          <div
                            key={deptName}
                            className="p-3 bg-amber-50 border border-amber-200 rounded"
                          >
                            <p className="text-xs text-amber-900">
                              ⚠️ {deptName} 부서에 구분이 설정된 직원이
                              없습니다.
                            </p>
                          </div>
                        )
                      }

                      const deptCategoryStaff =
                        combination.departmentCategoryStaff?.[deptName] || {}

                      return (
                        <div
                          key={deptName}
                          className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
                        >
                          <h4 className="font-semibold text-sm mb-3">
                            {deptName} (총 {deptRequired}명)
                          </h4>
                          <div className="space-y-2">
                            {deptCategories.map((catName) => {
                              const config = deptCategoryStaff[catName] || {
                                count: 0,
                                minRequired: 0,
                              }

                              return (
                                <div
                                  key={catName}
                                  className="grid grid-cols-[120px_1fr_1fr] gap-4 items-center p-2 bg-white rounded"
                                >
                                  <Label className="text-xs font-medium">
                                    {catName}
                                  </Label>

                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs text-gray-500 w-12">
                                      인원:
                                    </Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={deptRequired}
                                      value={config.count}
                                      onChange={(e) =>
                                        handleCountChange(
                                          combIndex,
                                          deptName,
                                          catName,
                                          Math.min(
                                            deptRequired,
                                            Math.max(
                                              0,
                                              parseInt(e.target.value) || 0
                                            )
                                          )
                                        )
                                      }
                                      className="h-8 flex-1"
                                    />
                                    <span className="text-xs text-gray-500">
                                      명
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`min-${combIndex}-${deptName}-${catName}`}
                                      checked={config.minRequired > 0}
                                      onCheckedChange={(checked) =>
                                        handleMinRequiredChange(
                                          combIndex,
                                          deptName,
                                          catName,
                                          checked ? config.count : 0
                                        )
                                      }
                                    />
                                    <Label
                                      htmlFor={`min-${combIndex}-${deptName}-${catName}`}
                                      className="text-xs cursor-pointer flex-1"
                                    >
                                      필수 인원
                                    </Label>
                                    {config.minRequired > 0 && (
                                      <Input
                                        type="number"
                                        min={0}
                                        max={config.count}
                                        value={config.minRequired}
                                        onChange={(e) =>
                                          handleMinRequiredChange(
                                            combIndex,
                                            deptName,
                                            catName,
                                            Math.min(
                                              config.count,
                                              Math.max(
                                                0,
                                                parseInt(e.target.value) || 0
                                              )
                                            )
                                          )
                                        }
                                        className="h-8 w-20"
                                      />
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
        <p className="text-sm text-blue-900">
          💡 <strong>안내:</strong>
        </p>
        <ul className="text-sm text-blue-900 space-y-1 ml-4 list-disc">
          <li>
            <strong>자동 계산:</strong> 현재 등록된 직원의 구분별 비율로 인원을
            자동 배분합니다.
          </li>
          <li>
            <strong>필수 인원:</strong> 체크하면 자동배치 시 반드시 배치되어야
            하는 최소 인원입니다.
          </li>
          <li>
            필수 인원을 충족할 수 없는 경우에도 가능한 만큼 배치하고 경고를
            표시합니다.
          </li>
        </ul>
      </div>
    </div>
  )
}
