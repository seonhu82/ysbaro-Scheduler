/**
 * 수동 스케줄 배치 API
 * POST: 특정 부서의 월간 스케줄을 수동으로 배치
 */

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    // ADMIN 권한 확인
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return errorResponse('Insufficient permissions', 403)
    }

    const body = await request.json()
    const { year, month, departmentName, assignments, annualLeaves } = body

    // 유효성 검증
    if (!year || !month || !departmentName) {
      return errorResponse('Year, month, and departmentName are required', 400)
    }

    if (!Array.isArray(assignments)) {
      return errorResponse('Assignments must be an array', 400)
    }

    const annualLeaveList = Array.isArray(annualLeaves) ? annualLeaves : []

    // 부서 확인 (자동배치 미사용 부서인지)
    const department = await prisma.department.findFirst({
      where: {
        clinicId: session.user.clinicId,
        name: departmentName
      }
    })

    if (!department) {
      return errorResponse('Department not found', 404)
    }

    if (department.useAutoAssignment) {
      return errorResponse('This department uses auto-assignment. Cannot manually assign.', 400)
    }

    // 스케줄 조회 (반드시 존재해야 함)
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId: session.user.clinicId,
        year,
        month,
        status: 'DEPLOYED' // 배포된 스케줄만 수동 배치 가능
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
      where: { clinicId: session.user.clinicId },
      select: { defaultWorkDays: true }
    })
    const workDayLimit = ruleSettings?.defaultWorkDays || 4

    // 해당 월의 기존 배치 삭제 (해당 부서 직원만)
    const departmentStaffIds = await prisma.staff.findMany({
      where: {
        clinicId: session.user.clinicId,
        departmentName,
        isActive: true
      },
      select: { id: true }
    })

    const staffIds = departmentStaffIds.map(s => s.id)

    // 배포 범위 체크 함수
    const isInDeployedRange = (date: Date) => {
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const startOnly = new Date(schedule.deployedStartDate!)
      const endOnly = new Date(schedule.deployedEndDate!)
      return dateOnly >= startOnly && dateOnly <= endOnly
    }

    // 기존 배치 데이터 조회 (비교를 위해)
    const existingAssignmentsAll = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staffId: { in: staffIds }
      },
      select: {
        date: true,
        staffId: true,
        shiftType: true
      }
    })

    // 날짜별로 그룹화 (기존 데이터)
    const existingByDate = new Map<string, Set<string>>()
    existingAssignmentsAll.forEach(a => {
      if (a.shiftType === 'DAY') {
        const dateStr = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, '0')}-${String(a.date.getDate()).padStart(2, '0')}`
        if (!existingByDate.has(dateStr)) {
          existingByDate.set(dateStr, new Set())
        }
        existingByDate.get(dateStr)!.add(a.staffId)
      }
    })

    // 새 배치 준비 및 실제 변경된 날짜만 추적
    const assignmentsToCreate = []
    const datesToUpdate = new Set<string>() // 실제로 변경된 날짜만

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

      // 기존 데이터와 비교
      const existingStaffIds = existingByDate.get(dateStr) || new Set()
      const newStaffIds = new Set(assignedStaffIds)

      // 변경 여부 확인 (크기가 다르거나 내용이 다르면 변경됨)
      const isChanged =
        existingStaffIds.size !== newStaffIds.size ||
        Array.from(newStaffIds).some(id => !existingStaffIds.has(id)) ||
        Array.from(existingStaffIds).some(id => !newStaffIds.has(id))

      if (isChanged) {
        // 변경된 날짜만 업데이트 대상에 추가
        datesToUpdate.add(dateStr)

        // 각 직원별로 배치 생성
        for (const staffId of assignedStaffIds) {
          assignmentsToCreate.push({
            scheduleId: schedule.id,
            staffId,
            date,
            shiftType: 'DAY' as const
          })
        }
      }
    }

    // ApplicationLink 생성 또는 조회 (연차 신청에 필요)
    // 관리자 수동배치용 ApplicationLink를 재사용하거나 생성
    let applicationLink = await prisma.applicationLink.findFirst({
      where: {
        clinicId: session.user.clinicId,
        year,
        month,
        staffId: null // 전체 직원용 링크
      }
    })

    if (!applicationLink) {
      // 링크가 없으면 생성
      const crypto = require('crypto')
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(year, month, 15) // 다음 달 15일까지 유효

      applicationLink = await prisma.applicationLink.create({
        data: {
          clinicId: session.user.clinicId,
          token,
          year,
          month,
          expiresAt,
          status: 'ACTIVE'
        }
      })
    }

    // 기존 연차 데이터 조회
    const existingLeavesAll = await prisma.leaveApplication.findMany({
      where: {
        clinicId: session.user.clinicId,
        staffId: { in: staffIds },
        status: 'CONFIRMED'
      },
      select: {
        date: true,
        staffId: true
      }
    })

    // 날짜별로 그룹화 (기존 연차)
    const existingLeavesByDate = new Map<string, Set<string>>()
    existingLeavesAll.forEach(l => {
      const dateStr = `${l.date.getFullYear()}-${String(l.date.getMonth() + 1).padStart(2, '0')}-${String(l.date.getDate()).padStart(2, '0')}`
      if (!existingLeavesByDate.has(dateStr)) {
        existingLeavesByDate.set(dateStr, new Set())
      }
      existingLeavesByDate.get(dateStr)!.add(l.staffId)
    })

    // 연차 신청 준비 (변경된 것만)
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

      // 기존 연차 데이터와 비교
      const existingLeaveStaffIds = existingLeavesByDate.get(dateStr) || new Set()
      const newLeaveStaffIds = new Set(annualLeaveStaffIds)

      const isChanged =
        existingLeaveStaffIds.size !== newLeaveStaffIds.size ||
        Array.from(newLeaveStaffIds).some(id => !existingLeaveStaffIds.has(id)) ||
        Array.from(existingLeaveStaffIds).some(id => !newLeaveStaffIds.has(id))

      if (isChanged) {
        // 변경된 날짜만 업데이트 대상에 추가
        datesToUpdate.add(dateStr)

        for (const staffId of annualLeaveStaffIds) {
          annualLeaveApplicationsToCreate.push({
            clinicId: session.user.clinicId,
            linkId: applicationLink.id,
            staffId,
            date,
            leaveType: 'ANNUAL' as const,
            status: 'CONFIRMED' as const
          })
        }
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

    // 업데이트할 날짜들을 Date 배열로 변환
    const updateDates = Array.from(datesToUpdate).map(str => new Date(str))

    // 기존 배치 조회 (업데이트할 날짜 제외)
    const existingAssignments = await prisma.staffAssignment.findMany({
      where: {
        scheduleId: schedule.id,
        staffId: { in: staffIds },
        shiftType: { not: 'OFF' },
        date: {
          notIn: updateDates
        }
      },
      select: {
        staffId: true,
        date: true
      }
    })

    // 주별, 직원별 근무일 수 계산 (기존 + 신규)
    const weeklyStaffWorkDays = new Map<string, Map<string, number>>()

    // 기존 배치 카운트
    for (const assignment of existingAssignments) {
      const weekKey = getWeekKey(assignment.date)

      if (!weeklyStaffWorkDays.has(weekKey)) {
        weeklyStaffWorkDays.set(weekKey, new Map<string, number>())
      }

      const weekData = weeklyStaffWorkDays.get(weekKey)!
      const count = weekData.get(assignment.staffId) || 0
      weekData.set(assignment.staffId, count + 1)
    }

    // 신규 배치 카운트
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

    // 주별로 날짜 범위 계산 (더 읽기 쉽게)
    const weekDateRanges = new Map<string, { start: Date; end: Date }>()

    for (const assignment of [...existingAssignments, ...assignmentsToCreate]) {
      const weekKey = getWeekKey(assignment.date)
      if (!weekDateRanges.has(weekKey)) {
        weekDateRanges.set(weekKey, { start: assignment.date, end: assignment.date })
      } else {
        const range = weekDateRanges.get(weekKey)!
        if (assignment.date < range.start) range.start = assignment.date
        if (assignment.date > range.end) range.end = assignment.date
      }
    }

    for (const [weekKey, staffCounts] of weeklyStaffWorkDays.entries()) {
      for (const [staffId, count] of staffCounts.entries()) {
        const staff = await prisma.staff.findUnique({
          where: { id: staffId },
          select: { name: true, workDays: true }
        })

        const limit = staff?.workDays || workDayLimit
        if (staff && count > limit) {
          // 날짜 범위 표시
          const range = weekDateRanges.get(weekKey)
          const rangeStr = range
            ? `${range.start.getMonth() + 1}/${range.start.getDate()}-${range.end.getMonth() + 1}/${range.end.getDate()}`
            : weekKey
          violations.push(`${staff.name} (${rangeStr}): ${count}일 근무 (제한: ${limit}일/주)`)
        }
      }
    }

    if (violations.length > 0) {
      return errorResponse(
        `주간 근무일 제한을 초과한 직원이 있습니다:\n${violations.join('\n')}`,
        400
      )
    }

    // 미배치 인원 OFF 처리를 위한 데이터 준비 (업데이트할 날짜만)
    const offAssignmentsToCreate: any[] = []

    // 업데이트할 날짜에 대해서만 OFF 처리
    for (const dateStr of datesToUpdate) {
      const [year, month, day] = dateStr.split('-').map(Number)
      const processDate = new Date(year, month - 1, day, 12, 0, 0) // 정오로 설정 (시간대 문제 방지)

      // 해당 날짜의 배치된 직원 ID
      const assignedOnDate = assignmentsToCreate
        .filter(a => {
          const aDate = new Date(a.date)
          const aDateStr = `${aDate.getFullYear()}-${String(aDate.getMonth() + 1).padStart(2, '0')}-${String(aDate.getDate()).padStart(2, '0')}`
          return aDateStr === dateStr
        })
        .map(a => a.staffId)

      // 해당 날짜의 연차 직원 ID
      const annualLeaveOnDate = annualLeaveApplicationsToCreate
        .filter(a => {
          const aDate = new Date(a.date)
          const aDateStr = `${aDate.getFullYear()}-${String(aDate.getMonth() + 1).padStart(2, '0')}-${String(aDate.getDate()).padStart(2, '0')}`
          return aDateStr === dateStr
        })
        .map(a => a.staffId)

      // 배치되거나 연차인 직원 ID 합집합
      const allocatedStaffIds = new Set([...assignedOnDate, ...annualLeaveOnDate])

      // 미배치 직원 = 전체 부서 직원 - 할당된 직원
      const unassignedStaffIds = staffIds.filter(id => !allocatedStaffIds.has(id))

      // 미배치 직원을 OFF로 추가
      for (const staffId of unassignedStaffIds) {
        offAssignmentsToCreate.push({
          scheduleId: schedule.id,
          staffId,
          date: processDate,
          shiftType: 'OFF'
        })
      }
    }

    // 디버깅 로그
    console.log(`\n🔄 수동 배치 저장 - ${departmentName} 부서 (${year}년 ${month}월)`)
    console.log(`   배포 범위: ${schedule.deployedStartDate?.toISOString().split('T')[0]} ~ ${schedule.deployedEndDate?.toISOString().split('T')[0]}`)
    console.log(`   업데이트 날짜 수: ${datesToUpdate.size}일`)
    console.log(`   부서 직원 수: ${staffIds.length}명`)
    console.log(`   DAY 배치: ${assignmentsToCreate.length}건`)
    console.log(`   연차: ${annualLeaveApplicationsToCreate.length}건`)
    console.log(`   OFF 배치: ${offAssignmentsToCreate.length}건`)

    // OFF 샘플 출력
    if (offAssignmentsToCreate.length > 0) {
      const sample = offAssignmentsToCreate.slice(0, 3).map(o =>
        `${o.date.toISOString().split('T')[0]}: ${o.staffId}`
      )
      console.log(`   OFF 샘플: ${sample.join(', ')}`)
    }

    // 트랜잭션으로 삭제 후 생성 (원자적 처리)
    await prisma.$transaction(async (tx) => {
      // 1. 기존 배치 삭제 (업데이트할 날짜만)
      await tx.staffAssignment.deleteMany({
        where: {
          scheduleId: schedule.id,
          staffId: { in: staffIds },
          date: {
            in: updateDates
          }
        }
      })

      // 2. 기존 연차 신청 삭제 (업데이트할 날짜만)
      await tx.leaveApplication.deleteMany({
        where: {
          clinicId: session.user.clinicId,
          staffId: { in: staffIds },
          date: {
            in: updateDates
          }
        }
      })

      // 3. 새 배치 생성
      if (assignmentsToCreate.length > 0) {
        await tx.staffAssignment.createMany({
          data: assignmentsToCreate
        })
        console.log(`   ✅ DAY 배치 ${assignmentsToCreate.length}건 저장 완료`)
      }

      // 4. 새 연차 신청 생성
      if (annualLeaveApplicationsToCreate.length > 0) {
        await tx.leaveApplication.createMany({
          data: annualLeaveApplicationsToCreate
        })
        console.log(`   ✅ 연차 ${annualLeaveApplicationsToCreate.length}건 저장 완료`)
      }

      // 5. OFF 배치 생성
      if (offAssignmentsToCreate.length > 0) {
        await tx.staffAssignment.createMany({
          data: offAssignmentsToCreate
        })
        console.log(`   ✅ OFF 배치 ${offAssignmentsToCreate.length}건 저장 완료`)
      }
    })

    console.log(`✅ 저장 완료\n`)

    return successResponse({
      scheduleId: schedule.id,
      created: assignmentsToCreate.length,
      annualLeaves: annualLeaveApplicationsToCreate.length,
      offs: offAssignmentsToCreate.length,
      message: `${departmentName} 부서의 ${year}년 ${month}월 스케줄이 저장되었습니다. (근무: ${assignmentsToCreate.length}, 연차: ${annualLeaveApplicationsToCreate.length}, OFF: ${offAssignmentsToCreate.length})`
    })
  } catch (error) {
    console.error('Manual assign error:', error)
    return errorResponse('Failed to save manual assignments', 500)
  }
}
