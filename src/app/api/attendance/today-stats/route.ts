/**
 * 오늘 출퇴근 통계 API
 * GET: 오늘 날짜의 실시간 출퇴근 통계
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    // 오늘 날짜 (KST 기준)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 오늘이 공휴일인지 확인
    const holidayToday = await prisma.holiday.findFirst({
      where: {
        clinicId: session.user.clinicId,
        date: today
      }
    })

    // 부서 정보 조회 (스케줄 사용 여부 확인)
    const departments = await prisma.department.findMany({
      where: {
        clinicId: session.user.clinicId
      },
      select: {
        name: true,
        useAutoAssignment: true
      }
    })

    // 스케줄 사용 부서와 미사용 부서 구분
    const scheduledDepartments = new Set(
      departments.filter(d => d.useAutoAssignment).map(d => d.name)
    )
    const nonScheduledDepartments = new Set(
      departments.filter(d => !d.useAutoAssignment).map(d => d.name)
    )

    // 오늘 스케줄 조회 (스케줄 사용 부서의 근무 예정 직원)
    // 단, 공휴일인 경우 스케줄 조회하지 않음
    const scheduleToday = holidayToday ? [] : await prisma.staffAssignment.findMany({
      where: {
        schedule: {
          clinicId: session.user.clinicId
        },
        date: today,
        shiftType: {
          not: 'OFF' // OFF가 아닌 근무만 (DAY, NIGHT)
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            departmentName: true
          }
        }
      }
    })

    // 스케줄 미사용 부서의 모든 활성 직원 조회
    // 단, 공휴일인 경우 조회하지 않음 (공휴일에는 아무도 출근 대상이 아님)
    const nonScheduledStaff = holidayToday ? [] : await prisma.staff.findMany({
      where: {
        clinicId: session.user.clinicId,
        isActive: true,
        departmentName: {
          in: Array.from(nonScheduledDepartments)
        }
      },
      select: {
        id: true,
        name: true,
        rank: true,
        departmentName: true
      }
    })

    // 오늘 출퇴근 기록 조회
    const recordsToday = await prisma.attendanceRecord.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: today
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            departmentName: true
          }
        }
      },
      orderBy: {
        checkTime: 'desc'
      }
    })

    // 출근한 직원 ID 목록
    const checkedInStaffIds = new Set(
      recordsToday
        .filter(r => r.checkType === 'IN')
        .map(r => r.staffId)
    )

    // 퇴근한 직원 ID 목록
    const checkedOutStaffIds = new Set(
      recordsToday
        .filter(r => r.checkType === 'OUT')
        .map(r => r.staffId)
    )

    // 스케줄 사용 부서와 미사용 부서의 직원 목록 생성
    const scheduledStaffList = scheduleToday.map(s => ({
      id: s.staff.id,
      name: s.staff.name,
      rank: s.staff.rank,
      departmentName: s.staff.departmentName,
      shiftType: s.shiftType
    }))

    const nonScheduledStaffList = nonScheduledStaff.map(s => ({
      id: s.id,
      name: s.name,
      rank: s.rank,
      departmentName: s.departmentName,
      shiftType: 'DAY' as const
    }))

    // Map을 사용하여 staffId 기준으로 중복 제거 (스케줄이 있는 직원 우선)
    const staffMap = new Map()

    // nonScheduledStaffList를 먼저 추가
    nonScheduledStaffList.forEach(s => {
      staffMap.set(s.id, s)
    })

    // scheduledStaffList를 나중에 추가하여 덮어쓰기 (스케줄 정보 우선)
    scheduledStaffList.forEach(s => {
      staffMap.set(s.id, s)
    })

    const allTargetStaff = Array.from(staffMap.values())

    // 현재 재직 중인 직원 (출근했지만 퇴근하지 않은)
    const currentlyInOffice = Array.from(checkedInStaffIds).filter(
      id => !checkedOutStaffIds.has(id)
    )

    // 근무 예정이지만 출근하지 않은 직원
    const notCheckedIn = allTargetStaff
      .filter(s => !checkedInStaffIds.has(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        rank: s.rank,
        departmentName: s.departmentName,
        shiftType: s.shiftType
      }))

    // 통계 계산
    const totalScheduled = allTargetStaff.length
    const totalCheckedIn = checkedInStaffIds.size
    const totalCheckedOut = checkedOutStaffIds.size
    const currentlyPresent = currentlyInOffice.length
    const notYetCheckedIn = notCheckedIn.length
    const suspiciousCount = recordsToday.filter(r => r.isSuspicious).length

    // 최근 출퇴근 기록 (최근 10개)
    const recentRecords = recordsToday.slice(0, 10).map(r => ({
      id: r.id,
      staffName: r.staff.name,
      checkType: r.checkType,
      checkTime: r.checkTime,
      isSuspicious: r.isSuspicious,
      suspiciousReason: r.suspiciousReason
    }))

    // 부서별 출근 현황
    const departmentStats = new Map<string, {
      scheduled: number
      checkedIn: number
      present: number
    }>()

    allTargetStaff.forEach(s => {
      const dept = s.departmentName || '미지정'
      if (!departmentStats.has(dept)) {
        departmentStats.set(dept, { scheduled: 0, checkedIn: 0, present: 0 })
      }
      const stats = departmentStats.get(dept)!
      stats.scheduled++
      if (checkedInStaffIds.has(s.id)) {
        stats.checkedIn++
      }
      if (currentlyInOffice.includes(s.id)) {
        stats.present++
      }
    })

    const byDepartment = Array.from(departmentStats.entries()).map(([dept, stats]) => ({
      department: dept,
      scheduled: stats.scheduled,
      checkedIn: stats.checkedIn,
      present: stats.present,
      checkInRate: stats.scheduled > 0 ? ((stats.checkedIn / stats.scheduled) * 100).toFixed(1) : '0.0'
    }))

    return successResponse({
      date: today.toISOString(),
      summary: {
        totalScheduled,        // 근무 예정 인원
        totalCheckedIn,        // 출근한 인원
        totalCheckedOut,       // 퇴근한 인원
        currentlyPresent,      // 현재 재직 중 인원
        notYetCheckedIn,       // 아직 출근하지 않은 인원
        suspiciousCount,       // 의심스러운 기록 수
        checkInRate: totalScheduled > 0
          ? ((totalCheckedIn / totalScheduled) * 100).toFixed(1)
          : '0.0'
      },
      notCheckedInList: notCheckedIn,
      recentRecords,
      byDepartment
    })
  } catch (error) {
    console.error('Get today stats error:', error)
    return errorResponse('Failed to fetch today stats', 500)
  }
}
