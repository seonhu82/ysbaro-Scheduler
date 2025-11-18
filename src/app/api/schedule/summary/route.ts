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
      select: {
        id: true,
        year: true,
        month: true,
        status: true,
        deployedAt: true,
        deployedEndDate: true,
        warnings: true, // 경고 정보 포함
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
                name: true,
                shortName: true
              }
            }
          }
        }
      }
    })

    if (!schedule) {
      return errorResponse('Schedule not found', 404)
    }

    // 이전 달 스케줄도 조회 (배포 범위에 포함될 수 있음)
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const prevSchedule = await prisma.schedule.findFirst({
      where: {
        clinicId: session.user.clinicId,
        year: prevYear,
        month: prevMonth,
        status: 'DEPLOYED'
      },
      select: {
        id: true,
        year: true,
        month: true,
        status: true,
        deployedAt: true,
        deployedEndDate: true,
        warnings: true,
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
                name: true,
                shortName: true
              }
            }
          }
        }
      }
    })

    // 월의 시작일과 종료일
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)
    const totalDays = endDate.getDate()

    // 이전 달 배포 범위도 고려한 날짜 범위
    let queryStartDate = startDate
    if (prevSchedule?.deployedEndDate) {
      const prevDeployedEnd = new Date(prevSchedule.deployedEndDate)
      // 이전 달 배포가 현재 달로 넘어오는 경우, 이전 달 시작일부터 조회
      if (prevDeployedEnd >= startDate) {
        queryStartDate = new Date(prevYear, prevMonth - 1, 1)
      }
    }

    // 연차/오프 신청 통계
    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: {
          gte: queryStartDate,
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

    // 현재 달과 이전 달의 모든 배정 데이터 합치기
    const allStaffAssignments = [
      ...schedule.staffAssignments,
      ...(prevSchedule?.staffAssignments || [])
    ]

    const allDoctors = [
      ...schedule.doctors,
      ...(prevSchedule?.doctors || [])
    ]

    // 기본 통계 (현재 달 기준)
    const totalAssignments = schedule.staffAssignments.length
    const dayShiftCount = schedule.staffAssignments.filter(a => a.shiftType === 'DAY').length
    const nightShiftCount = schedule.staffAssignments.filter(a => a.shiftType === 'NIGHT').length
    const offShiftCount = schedule.staffAssignments.filter(a => a.shiftType === 'OFF').length

    // 직원별 근무일수 통계 (현재 달에 속한 날짜만 - 이전 달 배포 데이터 포함)
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

    // 현재 달의 날짜 범위
    const currentMonthStart = new Date(year, month - 1, 1)
    const currentMonthEnd = new Date(year, month, 0)

    allStaffAssignments.forEach(assignment => {
      const assignmentDate = new Date(assignment.date)
      // 현재 달에 속한 배정만 통계에 포함
      if (assignmentDate >= currentMonthStart && assignmentDate <= currentMonthEnd) {
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

      const dayAssignments = allStaffAssignments.filter(a => {
        const assignmentDate = new Date(a.date).toISOString().split('T')[0]
        return assignmentDate === dateStr
      })

      const doctorsOnDay = allDoctors
        .filter(d => {
          const doctorDate = new Date(d.date).toISOString().split('T')[0]
          return doctorDate === dateStr
        })
        .map(d => d.doctor.shortName)

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

    // 경고 정보 파싱
    const warnings = schedule.warnings as string[] | null
    let warningsSummary = ''
    let totalWarnings = 0
    let workDayWarnings = 0
    let annualLeaveWarnings = 0

    if (warnings && Array.isArray(warnings) && warnings.length > 0) {
      totalWarnings = warnings.length

      // 주4일/주5일 미달 경고 개수
      workDayWarnings = warnings.filter(w =>
        w.includes('근무 미달')
      ).length

      // 연차 승인 관련 경고 개수
      annualLeaveWarnings = warnings.filter(w =>
        w.includes('연차 승인')
      ).length

      // 요약 문자열 생성
      const summaryParts: string[] = []
      if (workDayWarnings > 0) {
        summaryParts.push(`주4일 미만 근무 경고 ${workDayWarnings}건`)
      }
      if (annualLeaveWarnings > 0) {
        summaryParts.push(`연차 승인 ${annualLeaveWarnings}건`)
      }
      warningsSummary = summaryParts.join(', ')

      console.log(`⚠️ Warnings Summary: Total ${totalWarnings}건, 근무미달 ${workDayWarnings}건, 연차 ${annualLeaveWarnings}건`)
    }

    // 부서 정보 조회 (자동/수동 배치 구분)
    const departments = await prisma.department.findMany({
      where: {
        clinicId: session.user.clinicId
      },
      select: {
        name: true,
        useAutoAssignment: true
      }
    })

    const departmentTypeMap = new Map<string, boolean>()
    departments.forEach(dept => {
      departmentTypeMap.set(dept.name, dept.useAutoAssignment)
    })

    // 부서별 근무 통계 (현재 달에 속한 날짜만, 자동/수동 구분)
    const departmentStats = new Map<string, {
      dayShifts: number
      nightShifts: number
      offDays: number
      staffCount: number
      useAutoAssignment: boolean
    }>()

    allStaffAssignments.forEach(assignment => {
      const assignmentDate = new Date(assignment.date)
      // 현재 달에 속한 배정만 통계에 포함
      if (assignmentDate >= currentMonthStart && assignmentDate <= currentMonthEnd) {
        const dept = assignment.staff.departmentName || '미지정'
        if (!departmentStats.has(dept)) {
          departmentStats.set(dept, {
            dayShifts: 0,
            nightShifts: 0,
            offDays: 0,
            staffCount: 0,
            useAutoAssignment: departmentTypeMap.get(dept) ?? true
          })
        }

        const stats = departmentStats.get(dept)!
        if (assignment.shiftType === 'DAY') stats.dayShifts++
        if (assignment.shiftType === 'NIGHT') stats.nightShifts++
        if (assignment.shiftType === 'OFF') stats.offDays++
      }
    })

    // 부서별 직원 수 계산 (현재 달에 속한 날짜만)
    const uniqueStaffPerDept = new Map<string, Set<string>>()
    allStaffAssignments.forEach(assignment => {
      const assignmentDate = new Date(assignment.date)
      if (assignmentDate >= currentMonthStart && assignmentDate <= currentMonthEnd) {
        const dept = assignment.staff.departmentName || '미지정'
        if (!uniqueStaffPerDept.has(dept)) {
          uniqueStaffPerDept.set(dept, new Set())
        }
        uniqueStaffPerDept.get(dept)!.add(assignment.staffId)
      }
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
      useAutoAssignment: stats.useAutoAssignment,
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
      issuesDetail?: string
      status: string
      label: string
    }[] = []

    console.log(`📊 Summary API - Year: ${year}, Month: ${month}`)
    console.log(`  Total assignments: ${totalAssignments}`)
    console.log(`  Staff count: ${staffWorkDays.size}`)
    console.log(`  Doctor count: ${schedule.doctors.length}`)
    console.log(`  Prev schedule deployed: ${prevSchedule?.status === 'DEPLOYED' ? 'Yes' : 'No'}`)
    if (prevSchedule?.deployedEndDate) {
      console.log(`  Prev deployed end date: ${prevSchedule.deployedEndDate}`)
    }

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

        // 해당 날짜의 원장 스케줄 확인 (현재 달 + 이전 달 배포 데이터 모두 포함)
        const doctorsOnDay = allDoctors.filter(d => {
          const doctorDate = new Date(d.date).toISOString().split('T')[0]
          return doctorDate === dateStr
        })

        if (doctorsOnDay.length > 0) {
          hasDoctorSchedule = true

          // 원장 조합으로 필요 인원 찾기
          const doctorShortNames = Array.from(new Set(doctorsOnDay.map(d => d.doctor.shortName))).sort()
          const hasNightShift = doctorsOnDay.some(d => d.hasNightShift)

          const combination = allCombinations.find(c => {
            const combDoctors = (c.doctors as string[]).sort().join(',')
            return combDoctors === doctorShortNames.join(',') && c.hasNightShift === hasNightShift
          })

          const requiredStaff = combination?.requiredStaff || 0
          totalSlots += requiredStaff

          // 배치된 직원 수 (현재 달 + 이전 달 배포 데이터 모두 포함)
          const dayAssignments = allStaffAssignments.filter(a => {
            const assignmentDate = new Date(a.date).toISOString().split('T')[0]
            return assignmentDate === dateStr && (a.shiftType === 'DAY' || a.shiftType === 'NIGHT')
          })

          if (dayAssignments.length > 0) {
            hasStaffAssignment = true
          }

          assignedSlots += dayAssignments.length
        }
      }

      // 해당 주의 경고 건수 계산 (ON_HOLD 상태의 연차 신청)
      const weekStartDate = new Date(startDate)
      const weekEndDate = new Date(endDate)
      weekEndDate.setHours(23, 59, 59, 999)

      const weekLeaveIssues = leaveApplications.filter(l => {
        const leaveDate = new Date(l.date)
        return leaveDate >= weekStartDate &&
               leaveDate <= weekEndDate &&
               l.status === 'ON_HOLD'
      })

      const totalIssues = weekLeaveIssues.length
      const annualIssues = weekLeaveIssues.filter(l => l.leaveType === 'ANNUAL').length

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
        issues: totalIssues,
        issuesDetail: annualIssues > 0 ? `연차 ${annualIssues}건` : '',
        status,
        label
      })

      console.log(`  Week ${weekNum}: ${startDateStr} ~ ${endDateStr}, Slots: ${assignedSlots}/${totalSlots}, Issues: ${totalIssues}, Status: ${status}`)
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
      warnings: {
        total: totalWarnings,
        summary: warningsSummary,
        workDayWarnings,
        annualLeaveWarnings
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
