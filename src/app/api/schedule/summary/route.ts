/**
 * 스케줄 요약 API
 * GET: 월별 스케줄 요약 정보 (통계 및 개요)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      console.log('❌ Summary API: Unauthorized')
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    console.log(`🔍 Summary API called: ${year}년 ${month}월, clinicId: ${session.user.clinicId}`)

    // 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId: session.user.clinicId,
        year,
        month
      },
      include: {
        staffAssignments: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                rank: true,
                departmentName: true,
                categoryName: true
              }
            }
          }
        },
        doctors: {
          include: {
            doctor: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!schedule) {
      return errorResponse('Schedule not found', 404)
    }

    // 월의 시작일과 종료일
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)
    const totalDays = endDate.getDate()

    // 연차/오프 신청 통계
    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // 기본 통계
    const totalAssignments = schedule.staffAssignments.length
    const dayShiftCount = schedule.staffAssignments.filter(a => a.shiftType === 'DAY').length
    const nightShiftCount = schedule.staffAssignments.filter(a => a.shiftType === 'NIGHT').length
    const offShiftCount = schedule.staffAssignments.filter(a => a.shiftType === 'OFF').length

    // 직원별 근무일수 통계
    const staffWorkDays = new Map<string, {
      id: string
      name: string
      rank: string | null
      departmentName: string | null
      categoryName: string | null
      dayShifts: number
      nightShifts: number
      offDays: number
      totalDays: number
    }>()

    schedule.staffAssignments.forEach(assignment => {
      const staffId = assignment.staffId
      if (!staffWorkDays.has(staffId)) {
        staffWorkDays.set(staffId, {
          id: assignment.staff.id,
          name: assignment.staff.name,
          rank: assignment.staff.rank,
          departmentName: assignment.staff.departmentName,
          categoryName: assignment.staff.categoryName,
          dayShifts: 0,
          nightShifts: 0,
          offDays: 0,
          totalDays: 0
        })
      }

      const stats = staffWorkDays.get(staffId)!
      if (assignment.shiftType === 'DAY') {
        stats.dayShifts++
        stats.totalDays++
      } else if (assignment.shiftType === 'NIGHT') {
        stats.nightShifts++
        stats.totalDays++
      } else if (assignment.shiftType === 'OFF') {
        stats.offDays++
      }
    })

    // 직원별 통계를 배열로 변환
    const staffStats = Array.from(staffWorkDays.values())
      .sort((a, b) => b.totalDays - a.totalDays)

    // 일별 근무 인원 통계
    const dailyStats: {
      date: string
      dayOfWeek: string
      dayShifts: number
      nightShifts: number
      offShifts: number
      doctors: string[]
    }[] = []

    const dayNames = ['일', '월', '화', '수', '목', '금', '토']

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month - 1, day)
      const dateStr = date.toISOString().split('T')[0]
      const dayOfWeek = dayNames[date.getDay()]

      const dayAssignments = schedule.staffAssignments.filter(a => {
        const assignmentDate = new Date(a.date).toISOString().split('T')[0]
        return assignmentDate === dateStr
      })

      const doctorsOnDay = schedule.doctors
        .filter(d => {
          const doctorDate = new Date(d.date).toISOString().split('T')[0]
          return doctorDate === dateStr
        })
        .map(d => d.doctor.name)

      dailyStats.push({
        date: dateStr,
        dayOfWeek,
        dayShifts: dayAssignments.filter(a => a.shiftType === 'DAY').length,
        nightShifts: dayAssignments.filter(a => a.shiftType === 'NIGHT').length,
        offShifts: dayAssignments.filter(a => a.shiftType === 'OFF').length,
        doctors: doctorsOnDay
      })
    }

    // 연차/오프 통계
    const annualLeaveCount = leaveApplications.filter(
      l => l.leaveType === 'ANNUAL' && l.status === 'CONFIRMED'
    ).length
    const offLeaveCount = leaveApplications.filter(
      l => l.leaveType === 'OFF' && l.status === 'CONFIRMED'
    ).length
    const pendingLeaveCount = leaveApplications.filter(
      l => l.status === 'PENDING'
    ).length
    const onHoldLeaveCount = leaveApplications.filter(
      l => l.status === 'ON_HOLD'
    ).length

    // 부서별 근무 통계
    const departmentStats = new Map<string, {
      dayShifts: number
      nightShifts: number
      offDays: number
      staffCount: number
    }>()

    schedule.staffAssignments.forEach(assignment => {
      const dept = assignment.staff.departmentName || '미지정'
      if (!departmentStats.has(dept)) {
        departmentStats.set(dept, {
          dayShifts: 0,
          nightShifts: 0,
          offDays: 0,
          staffCount: 0
        })
      }

      const stats = departmentStats.get(dept)!
      if (assignment.shiftType === 'DAY') stats.dayShifts++
      if (assignment.shiftType === 'NIGHT') stats.nightShifts++
      if (assignment.shiftType === 'OFF') stats.offDays++
    })

    // 부서별 직원 수 계산
    const uniqueStaffPerDept = new Map<string, Set<string>>()
    schedule.staffAssignments.forEach(assignment => {
      const dept = assignment.staff.departmentName || '미지정'
      if (!uniqueStaffPerDept.has(dept)) {
        uniqueStaffPerDept.set(dept, new Set())
      }
      uniqueStaffPerDept.get(dept)!.add(assignment.staffId)
    })

    uniqueStaffPerDept.forEach((staffSet, dept) => {
      const stats = departmentStats.get(dept)!
      stats.staffCount = staffSet.size
    })

    const byDepartment = Array.from(departmentStats.entries()).map(([dept, stats]) => ({
      department: dept,
      staffCount: stats.staffCount,
      dayShifts: stats.dayShifts,
      nightShifts: stats.nightShifts,
      offDays: stats.offDays,
      avgDaysPerStaff: stats.staffCount > 0
        ? ((stats.dayShifts + stats.nightShifts) / stats.staffCount).toFixed(1)
        : '0.0'
    }))

    // 주차별 요약 계산
    const weekSummaries: {
      weekNumber: number
      startDate: string
      endDate: string
      totalSlots: number
      assignedSlots: number
      issues: number
    }[] = []

    console.log(`📊 Summary API - Year: ${year}, Month: ${month}`)
    console.log(`  Total assignments: ${totalAssignments}`)
    console.log(`  Staff count: ${staffWorkDays.size}`)
    console.log(`  Doctor count: ${schedule.doctors.length}`)

    // 해당 월의 모든 주차 계산
    const weeks = new Map<number, { dates: Date[] }>()
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month - 1, day)
      const weekNumber = Math.ceil(day / 7)

      if (!weeks.has(weekNumber)) {
        weeks.set(weekNumber, { dates: [] })
      }
      weeks.get(weekNumber)!.dates.push(date)
    }

    console.log(`  Total weeks: ${weeks.size}`)

    // 각 주차별 통계 계산
    weeks.forEach((week, weekNumber) => {
      const dates = week.dates
      const startDate = dates[0]
      const endDate = dates[dates.length - 1]
      const startDateStr = `${startDate.getMonth() + 1}월 ${startDate.getDate()}일`
      const endDateStr = `${endDate.getMonth() + 1}월 ${endDate.getDate()}일`

      // 해당 주의 모든 슬롯 계산
      let totalSlots = 0
      let assignedSlots = 0

      dates.forEach(date => {
        const dateStr = date.toISOString().split('T')[0]
        const dayAssignments = schedule.staffAssignments.filter(a => {
          const assignmentDate = new Date(a.date).toISOString().split('T')[0]
          return assignmentDate === dateStr
        })

        // 해당 날짜에 원장 스케줄이 있는지 확인
        const hasDoctorSchedule = schedule.doctors.some(d => {
          const doctorDate = new Date(d.date).toISOString().split('T')[0]
          return doctorDate === dateStr
        })

        if (hasDoctorSchedule) {
          // 원장 스케줄이 있는 날만 슬롯 카운트
          const workingStaff = dayAssignments.filter(a => a.shiftType === 'DAY' || a.shiftType === 'NIGHT')
          assignedSlots += workingStaff.length

          // 실제 필요 인원은 배치된 인원과 같음 (자동 배치가 필요 인원만큼 배치했으므로)
          // 또는 해당 날짜에 배치된 직원 수를 그대로 사용
          totalSlots += workingStaff.length
        }
      })

      weekSummaries.push({
        weekNumber,
        startDate: startDateStr,
        endDate: endDateStr,
        totalSlots,
        assignedSlots,
        issues: 0 // TODO: 실제 문제 감지 로직 추가
      })

      console.log(`  Week ${weekNumber}: ${startDateStr} ~ ${endDateStr}, Slots: ${assignedSlots}/${totalSlots}`)
    })

    console.log(`✅ Returning ${weekSummaries.length} week summaries`)

    return successResponse({
      period: {
        year,
        month,
        totalDays,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      status: schedule.status,
      deployedAt: schedule.deployedAt,
      summary: {
        totalAssignments,
        dayShiftCount,
        nightShiftCount,
        offShiftCount,
        uniqueStaffCount: staffWorkDays.size,
        uniqueDoctorCount: new Set(schedule.doctors.map(d => d.doctorId)).size,
        annualLeaveCount,
        offLeaveCount,
        pendingLeaveCount,
        onHoldLeaveCount
      },
      data: weekSummaries, // 주차별 요약 추가
      staffStats,
      dailyStats,
      byDepartment
    })
  } catch (error) {
    console.error('Get schedule summary error:', error)
    return errorResponse('Failed to fetch schedule summary', 500)
  }
}
