/**
 * 부서 및 카테고리 관련 유틸리티 함수
 *
 * 동적으로 설정된 부서와 카테고리를 조회하여 하드코딩을 방지합니다.
 */

import { prisma } from '@/lib/prisma'

/**
 * 자동 배치가 활성화된 부서 목록 조회
 *
 * @param clinicId - 병원 ID
 * @returns 자동 배치 활성화된 부서 목록
 */
export async function getAutoAssignDepartments(clinicId: string) {
  const departments = await prisma.department.findMany({
    where: {
      clinicId,
      useAutoAssignment: true
    },
    select: {
      name: true,
      order: true
    },
    orderBy: { order: 'asc' }
  })

  return departments
}

/**
 * 자동 배치가 활성화된 부서 이름 목록 조회 (Set)
 *
 * @param clinicId - 병원 ID
 * @returns 부서 이름 Set
 */
export async function getAutoAssignDepartmentNames(clinicId: string): Promise<Set<string>> {
  const departments = await getAutoAssignDepartments(clinicId)
  return new Set(departments.map(d => d.name))
}

/**
 * 모든 부서의 순서 맵 조회 (UI 정렬용)
 *
 * @param clinicId - 병원 ID
 * @returns 부서명 -> 순서 맵
 */
export async function getDepartmentOrderMap(clinicId: string): Promise<Record<string, number>> {
  const departments = await prisma.department.findMany({
    where: { clinicId },
    select: { name: true, order: true },
    orderBy: { order: 'asc' }
  })

  return departments.reduce((acc, dept, idx) => {
    acc[dept.name] = dept.order ?? idx
    return acc
  }, {} as Record<string, number>)
}

/**
 * 카테고리 순서 맵 조회 (UI 정렬용)
 *
 * @param clinicId - 병원 ID
 * @param departmentName - 부서명 (선택)
 * @returns 카테고리명 -> 순서 맵
 */
export async function getCategoryOrderMap(
  clinicId: string,
  departmentName?: string
): Promise<Record<string, number>> {
  const categories = await prisma.staffCategory.findMany({
    where: {
      clinicId,
      ...(departmentName && { departmentName })
    },
    select: { name: true, order: true },
    orderBy: { order: 'asc' }
  })

  return categories.reduce((acc, cat, idx) => {
    acc[cat.name] = cat.order ?? idx
    return acc
  }, {} as Record<string, number>)
}

/**
 * 특정 부서의 카테고리 목록 조회
 *
 * @param clinicId - 병원 ID
 * @param departmentName - 부서명
 * @returns 카테고리 목록 (우선순위 순)
 */
export async function getDepartmentCategories(clinicId: string, departmentName: string) {
  return await prisma.staffCategory.findMany({
    where: {
      clinicId,
      departmentName
    },
    orderBy: { priority: 'asc' }
  })
}

/**
 * Fallback: 자동 배치 부서가 없는 경우 기본값 반환
 *
 * 하위 호환성을 위해 자동 배치 부서가 설정되지 않은 경우
 * 기본값으로 '진료실'을 반환합니다.
 *
 * @param clinicId - 병원 ID
 * @returns 부서명 배열 (최소 1개 이상)
 */
export async function getAutoAssignDepartmentNamesWithFallback(
  clinicId: string
): Promise<string[]> {
  const departments = await getAutoAssignDepartments(clinicId)

  if (departments.length === 0) {
    console.warn(`⚠️ No departments with useAutoAssignment=true found for clinic ${clinicId}, using fallback '진료실'`)
    return ['진료실']
  }

  return departments.map(d => d.name)
}

/**
 * 특정 직원이 속한 부서가 자동 배치 대상인지 확인
 *
 * @param clinicId - 병원 ID
 * @param departmentName - 부서명
 * @returns 자동 배치 대상 여부
 */
export async function isDepartmentAutoAssign(
  clinicId: string,
  departmentName: string
): Promise<boolean> {
  const department = await prisma.department.findFirst({
    where: {
      clinicId,
      name: departmentName
    },
    select: { useAutoAssignment: true }
  })

  return department?.useAutoAssignment ?? false
}
