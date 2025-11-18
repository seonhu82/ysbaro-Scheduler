/**
 * 스케줄 무결성 검증 유틸리티
 *
 * 부서별 총 활성 직원 수 = 근무 + 연차 + 오프 합계가 되도록 검증
 */

import { prisma } from '@/lib/prisma'

export interface StaffAssignmentInfo {
  staffId: string
  staffName: string
  departmentName: string
  shiftType: 'DAY' | 'NIGHT' | 'OFF'
  isAnnual?: boolean
}

export interface LeaveInfo {
  staffId: string
  staffName: string
  departmentName: string
  leaveType: 'ANNUAL' | 'OFF'
  status: string
}

export interface ValidationResult {
  isValid: boolean
  missingStaff: Array<{
    id: string
    name: string
    departmentName: string
    rank: string
  }>
  departmentStats: Array<{
    departmentName: string
    expected: number
    actual: number
    working: number
    off: number
    annual: number
    missing: number
  }>
}

/**
 * 특정 날짜의 스케줄 무결성 검증
 *
 * @param clinicId 클리닉 ID
 * @param date 검증할 날짜
 * @param assignments 해당 날짜의 직원 배정 목록
 * @param leaves 해당 날짜의 연차 신청 목록
 * @returns 검증 결과
 */
export async function validateDailySchedule(
  clinicId: string,
  date: Date,
  assignments: StaffAssignmentInfo[],
  leaves: LeaveInfo[]
): Promise<ValidationResult> {

  // 1. 부서별 활성 직원 수 조회
  const departments = await prisma.department.findMany({
    where: { clinicId },
    select: { name: true }
  })

  const departmentStaffCount = new Map<string, number>()
  for (const dept of departments) {
    const count = await prisma.staff.count({
      where: {
        clinicId,
        departmentName: dept.name,
        isActive: true
      }
    })
    departmentStaffCount.set(dept.name, count)
  }

  // 2. 부서별 배정 집계
  const deptStats = new Map<string, {
    working: number
    off: number
    annual: number
    staffIds: Set<string>
  }>()

  departments.forEach(dept => {
    deptStats.set(dept.name, {
      working: 0,
      off: 0,
      annual: 0,
      staffIds: new Set()
    })
  })

  // StaffAssignment 집계
  assignments.forEach(a => {
    if (deptStats.has(a.departmentName)) {
      const stats = deptStats.get(a.departmentName)!
      stats.staffIds.add(a.staffId)

      if (a.shiftType === 'OFF') {
        // OFF인 경우, 연차인지 확인
        const isAnnual = leaves.some(l => l.staffId === a.staffId && l.leaveType === 'ANNUAL')
        if (isAnnual) {
          stats.annual++
        } else {
          stats.off++
        }
      } else {
        // DAY, NIGHT
        stats.working++
      }
    }
  })

  // LeaveApplication 중 StaffAssignment에 없는 ANNUAL 집계
  leaves.forEach(l => {
    if (l.leaveType === 'ANNUAL' && deptStats.has(l.departmentName)) {
      const stats = deptStats.get(l.departmentName)!
      if (!stats.staffIds.has(l.staffId)) {
        stats.annual++
        stats.staffIds.add(l.staffId)
      }
    }
  })

  // 3. 검증 및 누락 직원 찾기
  const missingStaff: Array<{
    id: string
    name: string
    departmentName: string
    rank: string
  }> = []

  const departmentStats: Array<{
    departmentName: string
    expected: number
    actual: number
    working: number
    off: number
    annual: number
    missing: number
  }> = []

  for (const [deptName, stats] of deptStats.entries()) {
    const expected = departmentStaffCount.get(deptName) || 0
    const actual = stats.working + stats.off + stats.annual

    if (actual !== expected) {
      // 누락된 직원 찾기
      const allDeptStaff = await prisma.staff.findMany({
        where: {
          clinicId,
          departmentName: deptName,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          departmentName: true,
          rank: true
        }
      })

      const missing = allDeptStaff.filter(s => !stats.staffIds.has(s.id))
      missingStaff.push(...missing)

      departmentStats.push({
        departmentName: deptName,
        expected,
        actual,
        working: stats.working,
        off: stats.off,
        annual: stats.annual,
        missing: expected - actual
      })
    }
  }

  return {
    isValid: missingStaff.length === 0,
    missingStaff,
    departmentStats
  }
}
