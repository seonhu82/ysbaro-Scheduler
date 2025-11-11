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
      status: string
      label: string
    }[] = []

    console.log(`📊 Summary API - Year: ${year}, Month: ${month}`)
    console.log(`  Total assignments: ${totalAssignments}`)
    console.log(`  Staff count: ${staffWorkDays.size}`)
    console.log(`  Doctor count: ${schedule.doctors.length}`)

    // 이전 달 스케줄 조회 (배포 범위 확인)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const prevSchedule = await prisma.schedule.findFirst({
      where: {
        clinicId: session.user.clinicId,
        year: prevYear,
        month: prevMonth
      },
      select: {
        deployedEndDate: true,
        status: true
      }
    })

    // 해당 월의 모든 주차 계산 (일~토 기준)
    const weeks = new Map<number, { dates: Date[], startDate: Date, endDate: Date }>()
    let weekNumber = 1

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay() // 0=일요일

      // 일요일이면 새로운 주 시작
      if (dayOfWeek === 0 && day !== 1) {
        weekNumber++
      }

      if (!weeks.has(weekNumber)) {
        weeks.set(weekNumber, { dates: [], startDate: date, endDate: date })
      }
      const week = weeks.get(weekNumber)!
      week.dates.push(date)
      week.endDate = date
    }

    console.log(`  Total weeks: ${weeks.size}`)

    // DoctorCombination 조회
    const allCombinations = await prisma.doctorCombination.findMany({
      where: {
        clinicId: session.user.clinicId
      }
    })

    // 각 주차별 통계 계산
    for (const [weekNum, week] of weeks.entries()) {
      const dates = week.dates
      const startDate = week.startDate
      const endDate = week.endDate
      const startDateStr = `${startDate.getMonth() + 1}월 ${startDate.getDate()}일`
      const endDateStr = `${endDate.getMonth() + 1}월 ${endDate.getDate()}일`

      // 이 주가 이전 달 배포 범위인지 확인
      const isFromPrevMonth = prevSchedule?.deployedEndDate &&
        prevSchedule.status === 'DEPLOYED' &&
        endDate <= new Date(prevSchedule.deployedEndDate)

      // 해당 주의 모든 슬롯 계산
      let totalSlots = 0
      let assignedSlots = 0
      let hasDoctorSchedule = false
      let hasStaffAssignment = false

      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0]

        // 해당 날짜의 원장 스케줄 확인
        const doctorsOnDay = schedule.doctors.filter(d => {
          const doctorDate = new Date(d.date).toISOString().split('T')[0]
          return doctorDate === dateStr
        })

        if (doctorsOnDay.length > 0) {
          hasDoctorSchedule = true

          // 원장 조합으로 필요 인원 찾기
          const doctorShortNames = Array.from(new Set(doctorsOnDay.map(d => d.doctor.name))).sort()
          const hasNightShift = doctorsOnDay.some(d => d.hasNightShift)

          const combination = allCombinations.find(c => {
            const combDoctors = (c.doctors as string[]).sort().join(',')
            return combDoctors === doctorShortNames.join(',') && c.hasNightShift === hasNightShift
          })

          const requiredStaff = combination?.requiredStaff || 0
          totalSlots += requiredStaff

          // 배치된 직원 수
          const dayAssignments = schedule.staffAssignments.filter(a => {
            const assignmentDate = new Date(a.date).toISOString().split('T')[0]
            return assignmentDate === dateStr && (a.shiftType === 'DAY' || a.shiftType === 'NIGHT')
          })

          if (dayAssignments.length > 0) {
            hasStaffAssignment = true
          }

          assignedSlots += dayAssignments.length
        }
      }

      // 상태 및 라벨 결정
      let status = 'empty'
      let label = `${weekNum}주차`

      if (isFromPrevMonth) {
        label = `${prevMonth}월 배포 완료`
        status = 'prev-month'
      } else if (!hasDoctorSchedule) {
        label = `${weekNum}주차 (원장 스케줄 없음)`
        status = 'no-doctor'
      } else if (!hasStaffAssignment) {
        label = `${weekNum}주차 (원장 스케줄 완료)`
        status = 'doctor-only'
      } else if (assignedSlots < totalSlots) {
        label = `${weekNum}주차 (진행중)`
        status = 'in-progress'
      } else {
        label = `${weekNum}주차 (직원 스케줄 완료)`
        status = 'completed'
      }

      weekSummaries.push({
        weekNumber: weekNum,
        startDate: startDateStr,
        endDate: endDateStr,
        totalSlots,
        assignedSlots,
        issues: 0,
        status,
        label
      })

      console.log(`  Week ${weekNum}: ${startDateStr} ~ ${endDateStr}, Slots: ${assignedSlots}/${totalSlots}, Status: ${status}`)
    }

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
