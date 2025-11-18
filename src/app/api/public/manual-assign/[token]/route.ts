/**
 * 부서장 수동 배치 공개 API
 * GET: 토큰으로 부서 정보 및 직원 목록 조회
 * POST: 부서장이 제출한 배치 저장
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/utils/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    // 토큰 유효성 확인
    const link = await prisma.manualAssignLink.findUnique({
      where: { token },
      include: {
        clinic: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!link) {
      return errorResponse('Invalid or expired link', 404)
    }

    // 만료 확인
    if (link.expiresAt < new Date()) {
      return errorResponse('Link has expired', 410)
    }

    // 부서 정보 가져오기
    const department = await prisma.department.findFirst({
      where: {
        clinicId: link.clinicId,
        name: link.departmentName
      }
    })

    if (!department) {
      return errorResponse('Department not found', 404)
    }

    // 부서 직원 목록 가져오기
    const staff = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        departmentName: link.departmentName,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        rank: true,
        workDays: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // 요청된 년월 또는 링크에 저장된 년월 사용
    const targetYear = year ? parseInt(year) : link.year
    const targetMonth = month ? parseInt(month) : link.month

    // 기존 배치 조회 (있다면)
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId: link.clinicId,
        year: targetYear,
        month: targetMonth,
        status: 'DEPLOYED' // 배포된 스케줄만
      }
    })

    if (!schedule) {
      return errorResponse('배포된 스케줄이 없습니다. 먼저 월간 스케줄을 배포해주세요.', 400)
    }

    if (!schedule.deployedStartDate || !schedule.deployedEndDate) {
      return errorResponse('스케줄의 배포 범위가 설정되지 않았습니다.', 400)
    }

    // 해당 배포 범위의 스케줄 및 공휴일 조회
    const scheduleData = await fetchMonthlySchedule(
      link.clinicId,
      schedule.deployedStartDate,
      schedule.deployedEndDate
    )

    // 기존 배치 및 연차 조회
    let existingAssignments: any = {}
    let existingAnnualLeaves: any = {}

    const assignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staffId: { in: staff.map(s => s.id) },
        date: {
          gte: schedule.deployedStartDate,
          lte: schedule.deployedEndDate
        },
        shiftType: { not: 'OFF' }
      },
      select: {
        staffId: true,
        date: true,
        shiftType: true
      }
    })

    // 날짜별로 그룹화
    assignments.forEach(assignment => {
      const dateKey = assignment.date.toISOString().split('T')[0]
      if (!existingAssignments[dateKey]) {
        existingAssignments[dateKey] = []
      }
      existingAssignments[dateKey].push(assignment.staffId)
    })

    // 연차 신청 조회
    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId: link.clinicId,
        staffId: { in: staff.map(s => s.id) },
        date: {
          gte: schedule.deployedStartDate,
          lte: schedule.deployedEndDate
        },
        leaveType: 'ANNUAL',
        status: { in: ['CONFIRMED', 'ON_HOLD'] }
      },
      select: {
        staffId: true,
        date: true
      }
    })

    // 연차 날짜별로 그룹화
    leaveApplications.forEach(leave => {
      const dateKey = leave.date.toISOString().split('T')[0]
      if (!existingAnnualLeaves[dateKey]) {
        existingAnnualLeaves[dateKey] = []
      }
      existingAnnualLeaves[dateKey].push(leave.staffId)
    })

    return successResponse({
      clinicId: link.clinicId,
      clinicName: link.clinic.name,
      departmentName: link.departmentName,
      year: targetYear,
      month: targetMonth,
      deployedStartDate: schedule.deployedStartDate.toISOString().split('T')[0],
      deployedEndDate: schedule.deployedEndDate.toISOString().split('T')[0],
      staff,
      scheduleData,
      existingAssignments,
      existingAnnualLeaves,
      expiresAt: link.expiresAt.toISOString()
    })
  } catch (error) {
    console.error('Get manual assign data error:', error)
    return errorResponse('Failed to fetch manual assign data', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const body = await request.json()
    const { assignments, annualLeaves } = body

    // 토큰 유효성 확인
    const link = await prisma.manualAssignLink.findUnique({
      where: { token },
      include: {
        clinic: true
      }
    })

    if (!link) {
      return errorResponse('Invalid or expired link', 404)
    }

    // 만료 확인
    if (link.expiresAt < new Date()) {
      return errorResponse('Link has expired', 410)
    }

    if (!Array.isArray(assignments)) {
      return errorResponse('Assignments must be an array', 400)
    }

    const annualLeaveList = Array.isArray(annualLeaves) ? annualLeaves : []

    // 부서 확인
    const department = await prisma.department.findFirst({
      where: {
        clinicId: link.clinicId,
        name: link.departmentName
      }
    })

    if (!department) {
      return errorResponse('Department not found', 404)
    }

    // 스케줄 조회 (반드시 존재해야 함)
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId: link.clinicId,
        year: link.year,
        month: link.month,
        status: 'DEPLOYED' // 배포된 스케줄만
      }
    })

    if (!schedule) {
      return errorResponse('배포된 스케줄이 없습니다. 먼저 월간 스케줄을 배포해주세요.', 400)
    }

    if (!schedule.deployedStartDate || !schedule.deployedEndDate) {
      return errorResponse('스케줄의 배포 범위가 설정되지 않았습니다.', 400)
    }

    // 설정에서 주간 근무일 제한 가져오기
    const ruleSettings = await prisma.ruleSettings.findUnique({
      where: { clinicId: link.clinicId },
      select: { defaultWorkDays: true }
    })
    const workDayLimit = ruleSettings?.defaultWorkDays || 4

    // 해당 부서 직원들의 기존 배치 삭제
    const departmentStaff = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        departmentName: link.departmentName,
        isActive: true
      },
      select: { id: true }
    })

    const staffIds = departmentStaff.map(s => s.id)

    // 배포 범위 체크 함수
    const isInDeployedRange = (date: Date) => {
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const startOnly = new Date(schedule.deployedStartDate!)
      const endOnly = new Date(schedule.deployedEndDate!)
      return dateOnly >= startOnly && dateOnly <= endOnly
    }

    // 새 배치 준비
    const assignmentsToCreate = []

    for (const assignment of assignments) {
      const { date: dateStr, staffIds: assignedStaffIds } = assignment

      if (!Array.isArray(assignedStaffIds) || assignedStaffIds.length === 0) {
        continue
      }

      const date = new Date(dateStr)

      // 배포 범위 밖의 날짜는 무시
      if (!isInDeployedRange(date)) {
        continue
      }

      for (const staffId of assignedStaffIds) {
        assignmentsToCreate.push({
          scheduleId: schedule.id,
          staffId,
          date,
          shiftType: 'DAY' as const
        })
      }
    }

    // 연차 신청 준비
    const annualLeaveApplicationsToCreate = []

    for (const annualLeave of annualLeaveList) {
      const { date: dateStr, staffIds: annualLeaveStaffIds } = annualLeave

      if (!Array.isArray(annualLeaveStaffIds) || annualLeaveStaffIds.length === 0) {
        continue
      }

      const date = new Date(dateStr)

      // 배포 범위 밖의 날짜는 무시
      if (!isInDeployedRange(date)) {
        continue
      }

      for (const staffId of annualLeaveStaffIds) {
        annualLeaveApplicationsToCreate.push({
          clinicId: link.clinicId,
          staffId,
          date,
          leaveType: 'ANNUAL' as const,
          status: 'CONFIRMED' as const,
          reason: '수동 배치에서 설정된 연차'
        })
      }
    }

    // 주별 근무일 제한 검증
    // 주는 일요일(0)~토요일(6)로 구분
    const getWeekKey = (date: Date) => {
      const year = date.getFullYear()
      const firstDayOfYear = new Date(year, 0, 1)
      const dayOfYear = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (1000 * 60 * 60 * 24))
      const weekNumber = Math.floor((dayOfYear + firstDayOfYear.getDay()) / 7)
      return `${year}-W${weekNumber}`
    }

    // 주별, 직원별 근무일 수 계산
    const weeklyStaffWorkDays = new Map<string, Map<string, number>>()

    for (const assignment of assignmentsToCreate) {
      const weekKey = getWeekKey(assignment.date)

      if (!weeklyStaffWorkDays.has(weekKey)) {
        weeklyStaffWorkDays.set(weekKey, new Map<string, number>())
      }

      const weekData = weeklyStaffWorkDays.get(weekKey)!
      const count = weekData.get(assignment.staffId) || 0
      weekData.set(assignment.staffId, count + 1)
    }

    // 주별 제한 초과 확인
    const violations: string[] = []

    for (const [weekKey, staffCounts] of weeklyStaffWorkDays.entries()) {
      for (const [staffId, count] of staffCounts.entries()) {
        const staff = await prisma.staff.findUnique({
          where: { id: staffId },
          select: { name: true, workDays: true }
        })

        const limit = staff?.workDays || workDayLimit
        if (staff && count > limit) {
          violations.push(`${staff.name} (${weekKey}주): ${count}일 근무 (제한: ${limit}일/주)`)
        }
      }
    }

    if (violations.length > 0) {
      return errorResponse(
        `주간 근무일 제한을 초과한 직원이 있습니다:\n${violations.join('\n')}`,
        400
      )
    }

    // 나머지 직원들 OFF 처리
    const offAssignmentsToCreate = []

    // 배포 범위의 모든 날짜 생성
    const deployedDates: Date[] = []
    const currentDate = new Date(schedule.deployedStartDate!)
    const endDate = new Date(schedule.deployedEndDate!)

    while (currentDate <= endDate) {
      deployedDates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // 각 날짜별로 OFF 처리
    for (const date of deployedDates) {
      const dateKey = date.toISOString().split('T')[0]

      // 해당 날짜에 배치된 직원 ID 수집
      const assignedStaffIdsOnDate = new Set(
        assignmentsToCreate
          .filter(a => a.date.toISOString().split('T')[0] === dateKey)
          .map(a => a.staffId)
      )

      // 해당 날짜에 연차인 직원 ID 수집
      const annualLeaveStaffIdsOnDate = new Set(
        annualLeaveApplicationsToCreate
          .filter(a => a.date.toISOString().split('T')[0] === dateKey)
          .map(a => a.staffId)
      )

      // 나머지 직원들 → OFF
      for (const staffId of staffIds) {
        if (!assignedStaffIdsOnDate.has(staffId) && !annualLeaveStaffIdsOnDate.has(staffId)) {
          offAssignmentsToCreate.push({
            scheduleId: schedule.id,
            staffId,
            date,
            shiftType: 'OFF' as const
          })
        }
      }
    }

    // 트랜잭션으로 삭제 후 생성 (원자적 처리)
    await prisma.$transaction(async (tx) => {
      // 1. 기존 배치 삭제 (배포 범위 내만)
      await tx.staffAssignment.deleteMany({
        where: {
          scheduleId: schedule.id,
          staffId: { in: staffIds },
          date: {
            gte: schedule.deployedStartDate!,
            lte: schedule.deployedEndDate!
          }
        }
      })

      // 2. 기존 연차 신청 삭제 (배포 범위 내의 수동 배치로 생성된 연차만)
      await tx.leaveApplication.deleteMany({
        where: {
          clinicId: link.clinicId,
          staffId: { in: staffIds },
          date: {
            gte: schedule.deployedStartDate!,
            lte: schedule.deployedEndDate!
          },
          reason: '수동 배치에서 설정된 연차'
        }
      })

      // 3. 새 배치 생성 (DAY)
      if (assignmentsToCreate.length > 0) {
        await tx.staffAssignment.createMany({
          data: assignmentsToCreate
        })
      }

      // 4. OFF 배치 생성
      if (offAssignmentsToCreate.length > 0) {
        await tx.staffAssignment.createMany({
          data: offAssignmentsToCreate
        })
      }

      // 5. 새 연차 신청 생성
      if (annualLeaveApplicationsToCreate.length > 0) {
        await tx.leaveApplication.createMany({
          data: annualLeaveApplicationsToCreate
        })
      }
    })

    return successResponse({
      scheduleId: schedule.id,
      created: assignmentsToCreate.length,
      offs: offAssignmentsToCreate.length,
      annualLeaves: annualLeaveApplicationsToCreate.length,
      message: `${link.departmentName} 부서의 ${link.year}년 ${link.month}월 스케줄이 저장되었습니다. (배치: ${assignmentsToCreate.length}, OFF: ${offAssignmentsToCreate.length}, 연차: ${annualLeaveApplicationsToCreate.length})`
    })
  } catch (error) {
    console.error('Save manual assign error:', error)
    return errorResponse('Failed to save manual assignments', 500)
  }
}

// 헬퍼 함수: 배포 범위 기반 스케줄 데이터 조회 (메인 화면과 동일한 구조)
async function fetchMonthlySchedule(
  clinicId: string,
  deployedStartDate: Date,
  deployedEndDate: Date
) {
  // 공휴일 조회 (배포 범위로 조회)
  const holidays = await prisma.holiday.findMany({
    where: {
      clinicId,
      date: {
        gte: deployedStartDate,
        lte: deployedEndDate
      }
    },
    select: {
      date: true,
      name: true
    }
  })

  const holidayMap: { [date: string]: string } = {}
  holidays.forEach(holiday => {
    const dateKey = new Date(holiday.date).toISOString().split('T')[0]
    holidayMap[dateKey] = holiday.name
  })

  // **의사 스케줄 기준으로 조회** (배포 범위 내)
  const doctorSchedules = await prisma.scheduleDoctor.findMany({
    where: {
      schedule: {
        clinicId,
        status: 'DEPLOYED'
      },
      date: {
        gte: deployedStartDate,
        lte: deployedEndDate
      }
    },
    include: {
      doctor: {
        select: {
          name: true,
          shortName: true
        }
      }
    }
  })

  // 조합명 조회
  const combinations = await prisma.doctorCombination.findMany({
    where: { clinicId },
    select: {
      id: true,
      name: true,
      doctors: true,
      hasNightShift: true,
      dayOfWeek: true
    }
  })

  // 날짜별 조합 매칭 맵
  const doctorScheduleByDate: { [date: string]: { hasNightShift: boolean; doctorIds: string[] } } = {}

  doctorSchedules.forEach(assignment => {
    const dateKey = assignment.date.toISOString().split('T')[0]
    if (!doctorScheduleByDate[dateKey]) {
      doctorScheduleByDate[dateKey] = {
        hasNightShift: false,
        doctorIds: []
      }
    }
    doctorScheduleByDate[dateKey].hasNightShift = doctorScheduleByDate[dateKey].hasNightShift || assignment.hasNightShift
    doctorScheduleByDate[dateKey].doctorIds.push(assignment.doctorId)
  })

  // 날짜별 데이터 구성 (배포 범위의 모든 날짜)
  const scheduleData: { [date: string]: any } = {}
  const currentDate = new Date(deployedStartDate)

  while (currentDate <= deployedEndDate) {
    const dateKey = currentDate.toISOString().split('T')[0]
    const doctorData = doctorScheduleByDate[dateKey]

    let combinationName = undefined
    let hasNightShift = false
    let doctorShortNames: string[] = []

    if (doctorData) {
      hasNightShift = doctorData.hasNightShift
      const sortedDoctorIds = [...doctorData.doctorIds].sort()

      // 조합 매칭 (요일 기준)
      const dayOfWeek = currentDate.getDay()
      const matchingCombination = combinations.find(c => {
        if (c.dayOfWeek !== null && c.dayOfWeek !== dayOfWeek) return false
        if (c.hasNightShift !== hasNightShift) return false
        const combDoctorIds = (c.doctors || []) as string[]
        if (combDoctorIds.length !== sortedDoctorIds.length) return false
        const sortedCombDoctorIds = [...combDoctorIds].sort()
        return JSON.stringify(sortedCombDoctorIds) === JSON.stringify(sortedDoctorIds)
      })

      if (matchingCombination) {
        combinationName = matchingCombination.name
      }

      // 의사 짧은 이름 수집
      const doctorsOnDate = doctorSchedules.filter(s => s.date.toISOString().split('T')[0] === dateKey)
      doctorShortNames = doctorsOnDate.map(s => s.doctor.shortName || s.doctor.name)
    }

    scheduleData[dateKey] = {
      combinationName,
      hasNightShift,
      doctorShortNames,
      holidayName: holidayMap[dateKey] || null
    }

    // 다음 날로 이동
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return scheduleData
}
