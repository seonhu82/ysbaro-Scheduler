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

    // URL에서 날짜 파라미터 가져오기
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    // 날짜 설정 (파라미터가 있으면 사용, 없으면 오늘)
    let today: Date
    if (dateParam) {
      // YYYY-MM-DD 형식으로 전달된 날짜를 UTC로 변환
      const [year, month, day] = dateParam.split('-').map(Number)
      today = new Date(Date.UTC(year, month - 1, day))
    } else {
      // 오늘 날짜 (KST 기준, UTC로 변환)
      const now = new Date()
      const kstOffset = 9 * 60 // KST는 UTC+9
      const kstNow = new Date(now.getTime() + kstOffset * 60 * 1000)
      today = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()))
    }

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

    // 오늘 스케줄 조회 (부서 구분 없이 모든 근무 예정 직원)
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
        },
        substituteForStaff: {
          select: {
            id: true,
            name: true,
            rank: true,
            departmentName: true
          }
        }
      }
    })

    console.log('📋 오늘 스케줄 조회 결과:', {
      date: today.toISOString(),
      isHoliday: !!holidayToday,
      scheduleCount: scheduleToday.length,
      schedules: scheduleToday.map(s => ({
        staffId: s.staff.id,
        staffName: s.staff.name,
        department: s.staff.departmentName,
        shiftType: s.shiftType
      }))
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

    // 스케줄에 있는 모든 직원 목록 생성 (부서 구분 없이)
    const allTargetStaff = scheduleToday.map(s => ({
      id: s.staff.id,
      name: s.staff.name,
      rank: s.staff.rank,
      departmentName: s.staff.departmentName,
      shiftType: s.shiftType,
      isSubstitute: s.isSubstitute,
      substituteForStaff: s.substituteForStaff,
      substitutedAt: s.substitutedAt
    }))

    console.log('👥 전체 출근 대상 직원:', {
      count: allTargetStaff.length,
      staff: allTargetStaff.map(s => `${s.name}(${s.departmentName}, ${s.shiftType})`)
    })

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

    // 지각/조퇴 인원 계산 (나중에 scheduledStaffListWithStatus에서 계산됨)
    let lateCount = 0
    let earlyLeaveCount = 0

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
      total: stats.scheduled,
      useSchedule: scheduledDepartments.has(dept),
      scheduled: stats.scheduled,
      checkedIn: stats.checkedIn,
      present: stats.present,
      checkInRate: stats.scheduled > 0 ? ((stats.checkedIn / stats.scheduled) * 100).toFixed(1) : '0.0'
    }))

    // 출근 대상 직원 목록 (스케줄 + 출퇴근 상태)
    const scheduledStaffListWithStatus = allTargetStaff.map(s => {
      const checkInRecord = recordsToday.find(r => r.staffId === s.id && r.checkType === 'IN')
      const checkOutRecord = recordsToday.find(r => r.staffId === s.id && r.checkType === 'OUT')

      // 지각 확인 (09:00 기준)
      let isLate = false
      let lateMinutes = 0
      if (checkInRecord) {
        const checkInTime = new Date(checkInRecord.checkTime)
        const checkInHour = checkInTime.getHours()
        const checkInMinute = checkInTime.getMinutes()
        const standardHour = 9
        const standardMinute = 0

        if (checkInHour > standardHour || (checkInHour === standardHour && checkInMinute > standardMinute)) {
          isLate = true
          lateMinutes = (checkInHour - standardHour) * 60 + (checkInMinute - standardMinute)
        }
      }

      // 조퇴 확인 (18:00 기준)
      let isEarlyLeave = false
      let earlyMinutes = 0
      if (checkOutRecord && !checkedOutStaffIds.has(s.id)) {
        const checkOutTime = new Date(checkOutRecord.checkTime)
        const checkOutHour = checkOutTime.getHours()
        const checkOutMinute = checkOutTime.getMinutes()
        const standardHour = 18
        const standardMinute = 0

        if (checkOutHour < standardHour || (checkOutHour === standardHour && checkOutMinute < standardMinute)) {
          isEarlyLeave = true
          earlyMinutes = (standardHour - checkOutHour) * 60 + (standardMinute - checkOutMinute)
        }
      }

      // 지각/조퇴 인원 카운트
      if (isLate) lateCount++
      if (isEarlyLeave) earlyLeaveCount++

      return {
        id: s.id,
        name: s.name,
        rank: s.rank,
        departmentName: s.departmentName,
        shiftType: s.shiftType,
        isScheduled: true,
        useSchedule: scheduledDepartments.has(s.departmentName || ''),
        isCheckedIn: checkedInStaffIds.has(s.id),
        isCheckedOut: checkedOutStaffIds.has(s.id),
        isPresent: currentlyInOffice.includes(s.id),
        checkInTime: checkInRecord?.checkTime?.toISOString(),
        checkOutTime: checkOutRecord?.checkTime?.toISOString(),
        isLate,
        lateMinutes,
        isEarlyLeave,
        earlyMinutes,
        notes: checkInRecord?.notes || checkOutRecord?.notes,
        isSubstitute: s.isSubstitute,
        substituteForStaff: s.substituteForStaff,
        substitutedAt: s.substitutedAt?.toISOString()
      }
    })

    // 출근한 인원 목록 (최근 출근 시간 포함)
    const checkedInStaffList = Array.from(checkedInStaffIds).map(staffId => {
      const staff = allTargetStaff.find(s => s.id === staffId)
      const checkInRecord = recordsToday.find(r => r.staffId === staffId && r.checkType === 'IN')
      const isScheduled = !!staff // 스케줄에 있는지 확인
      return {
        id: staffId,
        name: staff?.name || checkInRecord?.staff.name || '알 수 없음',
        rank: staff?.rank || checkInRecord?.staff.rank || '',
        departmentName: staff?.departmentName || checkInRecord?.staff.departmentName || '',
        isScheduled, // 스케줄에 있는지 여부
        isCheckedIn: true,
        isCheckedOut: checkedOutStaffIds.has(staffId),
        isPresent: currentlyInOffice.includes(staffId),
        checkTime: checkInRecord?.checkTime?.toISOString()
      }
    })

    return successResponse({
      date: today.toISOString(),
      summary: {
        totalStaff: totalScheduled,
        totalScheduled: allTargetStaff.filter(s => scheduledDepartments.has(s.departmentName || '')).length,
        totalNonScheduled: allTargetStaff.filter(s => nonScheduledDepartments.has(s.departmentName || '')).length,
        totalCheckedIn,        // 출근한 인원
        totalCheckedOut,       // 퇴근한 인원
        currentlyPresent,      // 현재 재직 중 인원
        notYetCheckedIn,       // 아직 출근하지 않은 인원
        suspiciousCount,       // 의심스러운 기록 수
        lateCount,             // 지각 인원
        earlyLeaveCount,       // 조퇴 인원
        checkInRate: totalScheduled > 0
          ? ((totalCheckedIn / totalScheduled) * 100).toFixed(1)
          : '0.0'
      },
      scheduledStaffList: scheduledStaffListWithStatus,
      checkedInStaffList: checkedInStaffList,
      notCheckedInList: notCheckedIn,
      recentRecords,
      byDepartment
    })
  } catch (error) {
    console.error('Get today stats error:', error)
    return errorResponse('Failed to fetch today stats', 500)
  }
}
