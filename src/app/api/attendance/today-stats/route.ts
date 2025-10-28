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

    // 오늘 스케줄 조회 (근무 예정 직원)
    const scheduleToday = await prisma.staffAssignment.findMany({
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

    // 현재 재직 중인 직원 (출근했지만 퇴근하지 않은)
    const currentlyInOffice = Array.from(checkedInStaffIds).filter(
      id => !checkedOutStaffIds.has(id)
    )

    // 근무 예정이지만 출근하지 않은 직원
    const notCheckedIn = scheduleToday
      .filter(s => !checkedInStaffIds.has(s.staffId))
      .map(s => ({
        id: s.staff.id,
        name: s.staff.name,
        rank: s.staff.rank,
        departmentName: s.staff.departmentName,
        shiftType: s.shiftType
      }))

    // 통계 계산
    const totalScheduled = scheduleToday.length
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

    scheduleToday.forEach(s => {
      const dept = s.staff.departmentName || '미지정'
      if (!departmentStats.has(dept)) {
        departmentStats.set(dept, { scheduled: 0, checkedIn: 0, present: 0 })
      }
      const stats = departmentStats.get(dept)!
      stats.scheduled++
      if (checkedInStaffIds.has(s.staffId)) {
        stats.checkedIn++
      }
      if (currentlyInOffice.includes(s.staffId)) {
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
