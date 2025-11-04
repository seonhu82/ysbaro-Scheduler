/**
 * 날짜별 스케줄 조회 및 수정 API
 * GET: 특정 날짜의 스케줄 데이터 (원장, 직원 배치)
 * POST: 특정 날짜의 스케줄 데이터 수정 (원장, 직원 배치, 연차/오프)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'
import { getAutoAssignDepartmentNamesWithFallback, getCategoryOrderMap } from '@/lib/utils/department-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const statusParam = searchParams.get('status') // DRAFT or DEPLOYED

    if (!dateParam) {
      return badRequestResponse('Date parameter is required')
    }

    const clinicId = session.user.clinicId
    // 시간대 문제 해결: dateParam을 직접 Date 객체로 생성
    const dateOnly = new Date(dateParam + 'T00:00:00.000Z')

    // Schedule 조건 구성
    const scheduleWhere: any = { clinicId }

    // year/month가 제공되면 특정 스케줄만 조회
    if (yearParam && monthParam) {
      scheduleWhere.year = parseInt(yearParam)
      scheduleWhere.month = parseInt(monthParam)
    }

    // status가 제공되면 해당 상태만 조회 (DRAFT or DEPLOYED)
    if (statusParam) {
      scheduleWhere.status = statusParam
    } else {
      // status 미지정 시 DRAFT와 DEPLOYED 모두 조회
      scheduleWhere.status = { in: ['DRAFT', 'DEPLOYED'] }
    }

    // 1. ScheduleDoctor 조회 (해당 날짜의 원장 스케줄)
    const doctorSchedules = await prisma.scheduleDoctor.findMany({
      where: {
        date: dateOnly,
        schedule: scheduleWhere
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        }
      }
    })

    // 2. StaffAssignment 조회 (해당 날짜의 직원 배치)
    const staffAssignments = await prisma.staffAssignment.findMany({
      where: {
        date: dateOnly,
        schedule: scheduleWhere
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            categoryName: true,
            departmentName: true
          }
        }
      }
    })

    // 3. LeaveApplication 조회 (해당 날짜의 연차/오프 신청)
    console.log('Querying leave applications for date:', dateOnly)
    const leaveApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: dateOnly,
        status: 'CONFIRMED'
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            categoryName: true,
            departmentName: true
          }
        }
      }
    })
    console.log('Found leave applications:', leaveApplications.length)

    // 데이터가 없으면 빈 스케줄 반환
    if (doctorSchedules.length === 0 && staffAssignments.length === 0 && leaveApplications.length === 0) {
      return successResponse({
        date: dateParam,
        doctors: [],
        staff: [],
        annualLeave: [],
        offDays: [],
        isNightShift: false,
        isEmpty: true
      })
    }

    // 연차와 수동 오프 구분
    const annualLeave = leaveApplications
      .filter(la => la.leaveType === 'ANNUAL')
      .map(la => ({
        id: la.staff.id,
        name: la.staff.name,
        rank: la.staff.rank,
        categoryName: la.staff.categoryName,
        departmentName: la.staff.departmentName
      }))

    const manualOffDays = leaveApplications
      .filter(la => la.leaveType === 'OFF')
      .map(la => ({
        id: la.staff.id,
        name: la.staff.name,
        rank: la.staff.rank,
        categoryName: la.staff.categoryName,
        departmentName: la.staff.departmentName
      }))

    // 4. OFF 배정: StaffAssignment에서 shiftType='OFF'인 직원만
    const offAssignments = await prisma.staffAssignment.findMany({
      where: {
        date: dateOnly,
        shiftType: 'OFF',
        schedule: scheduleWhere
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            categoryName: true,
            departmentName: true
          }
        }
      }
    })

    const offDays = offAssignments.map(oa => ({
      id: oa.staff.id,
      name: oa.staff.name,
      rank: oa.staff.rank,
      categoryName: oa.staff.categoryName,
      departmentName: oa.staff.departmentName
    }))

    // 5. 만약 StaffAssignment에 OFF가 없으면 자동 계산
    let allOffDays = [...manualOffDays, ...offDays]

    // OFF가 0명인 경우 자동 계산 (배정되지 않은 직원들)
    if (allOffDays.length === 0 && staffAssignments.length > 0) {
      // 자동 배치 부서의 전체 활성 직원 조회
      const autoAssignDeptNames = await getAutoAssignDepartmentNamesWithFallback(clinicId)
      const allActiveStaff = await prisma.staff.findMany({
        where: {
          clinicId,
          isActive: true,
          departmentName: { in: autoAssignDeptNames }
        },
        select: {
          id: true,
          name: true,
          rank: true,
          categoryName: true,
          departmentName: true
        }
      })

      // 근무자 ID
      const workingStaffIds = new Set(staffAssignments.map(sa => sa.staff.id))
      // 연차 ID
      const annualLeaveIds = new Set(annualLeave.map(al => al.id))

      // 자동 OFF 계산: 전체 - 근무 - 연차
      allOffDays = allActiveStaff
        .filter(staff => !workingStaffIds.has(staff.id) && !annualLeaveIds.has(staff.id))
        .map(staff => ({
          id: staff.id,
          name: staff.name,
          rank: staff.rank,
          categoryName: staff.categoryName,
          departmentName: staff.departmentName
        }))
    }

    // 응답 데이터 구성
    const responseData = {
      date: dateParam,
      doctors: doctorSchedules.map(ds => ({
        id: ds.doctor.id,
        name: ds.doctor.name
      })),
      staff: staffAssignments
        .filter(sa => sa.shiftType !== 'OFF') // OFF 제외
        .map(sa => ({
          id: sa.staff.id,
          name: sa.staff.name,
          rank: sa.staff.rank,
          categoryName: sa.staff.categoryName,
          departmentName: sa.staff.departmentName
        })),
      annualLeave,
      offDays: allOffDays, // 수동 오프 + 자동 오프
      isNightShift: doctorSchedules.some(ds => ds.hasNightShift),
      isEmpty: false
    }

    return successResponse(responseData)
  } catch (error) {
    console.error('Get day schedule error:', error)
    return errorResponse('Failed to fetch day schedule', 500)
  }
}

/**
 * POST: 특정 날짜의 스케줄 수정
 * - 원장 배치 수정
 * - 직원 근무/연차/오프 상태 변경
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { date, doctors, staff, annualLeave, offDays, isNightShift, year, month, skipValidation, dryRun } = body

    if (!date) {
      return badRequestResponse('Date is required')
    }

    const clinicId = session.user.clinicId
    const dateOnly = new Date(date + 'T00:00:00.000Z')

    console.log('Saving day schedule:', { date, doctors: doctors?.length, staff: staff?.length, annualLeave: annualLeave?.length, offDays: offDays?.length, skipValidation, dryRun })

    // ========== 검증 로직 (skipValidation이 true면 건너뜀) ==========
    const warnings: string[] = []
    if (!skipValidation) {

    // 1. 원장-직원 조합 확인
    if (doctors && doctors.length > 0) {
      const doctorCombination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: {
            hasSome: doctors.map((d: any) => d.id)
          }
        }
      })

      if (doctorCombination) {
        const requiredStaff = doctorCombination.requiredStaff
        const actualStaff = staff?.length || 0

        // 1-1. 필수 인원 체크
        if (actualStaff < requiredStaff) {
          warnings.push(`⚠️ 필수 인원 미달: 필요 ${requiredStaff}명, 현재 ${actualStaff}명 (${requiredStaff - actualStaff}명 부족)`)
        }

        // 1-2. 카테고리별 필수 인원 체크
        if (doctorCombination.departmentCategoryStaff) {
          const categoryStaff = doctorCombination.departmentCategoryStaff as any
          const requiredCategories = categoryStaff['진료실'] || {} // Note: This uses legacy key for backward compatibility

          // 실제 배치된 카테고리별 인원 계산
          const actualCategories: any = {}
          for (const s of staff || []) {
            const cat = s.categoryName || '미분류'
            actualCategories[cat] = (actualCategories[cat] || 0) + 1
          }

          console.log('📊 카테고리 검증:', {
            required: requiredCategories,
            actual: actualCategories
          })

          // 카테고리별 체크
          for (const [category, required] of Object.entries(requiredCategories)) {
            const actual = actualCategories[category] || 0
            const reqData = required as any

            // count: 권장 인원, minRequired: 최소 필수 인원
            const minRequired = reqData.minRequired || 0
            const recommendedCount = reqData.count || 0

            // 최소 필수 인원 체크 (경고)
            if (actual < minRequired) {
              warnings.push(`⚠️ ${category} 최소 인원 미달: 최소 ${minRequired}명 필요, 현재 ${actual}명`)
            }
            // 권장 인원 체크 (정보성)
            else if (actual < recommendedCount) {
              warnings.push(`ℹ️ ${category} 권장 인원 부족: 권장 ${recommendedCount}명, 현재 ${actual}명`)
            }
          }
        }
      }
    }

    // 2. 주4일 제한 체크 (해당 주차에서 4일 초과 여부)
    const weekStart = new Date(dateOnly)
    weekStart.setDate(dateOnly.getDate() - dateOnly.getDay()) // 일요일로
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6) // 토요일까지

    for (const s of staff || []) {
      const weeklyWorkDays = await prisma.staffAssignment.count({
        where: {
          staffId: s.id,
          date: {
            gte: weekStart,
            lte: weekEnd
          },
          shiftType: {
            in: ['DAY', 'NIGHT']
          }
        }
      })

      if (weeklyWorkDays > 4) {
        warnings.push(`⚠️ ${s.name}: 주4일 초과 (현재 ${weeklyWorkDays}일 근무 예정)`)
      }
    }

    // 3. 형평성 체크 (이번 달 전체 근무일 수 비교)
    if (year && month) {
      const monthStart = new Date(year, month - 1, 1)
      const monthEnd = new Date(year, month, 0)

      // 자동 배치 부서의 전체 직원 조회
      const autoAssignDeptNames = await getAutoAssignDepartmentNamesWithFallback(clinicId)
      const allTreatmentStaff = await prisma.staff.findMany({
        where: {
          clinicId,
          isActive: true,
          departmentName: { in: autoAssignDeptNames }
        },
        select: {
          id: true,
          name: true
        }
      })

      // 각 직원별 이번 달 근무일 수 계산
      const staffWorkDays = new Map<string, { name: string; workDays: number }>()
      for (const s of allTreatmentStaff) {
        const workDays = await prisma.staffAssignment.count({
          where: {
            staffId: s.id,
            date: {
              gte: monthStart,
              lte: monthEnd
            },
            shiftType: {
              in: ['DAY', 'NIGHT']
            }
          }
        })
        staffWorkDays.set(s.id, { name: s.name, workDays })
      }

      // 평균 근무일 계산
      const totalWorkDays = Array.from(staffWorkDays.values()).reduce((sum, s) => sum + s.workDays, 0)
      const avgWorkDays = totalWorkDays / staffWorkDays.size

      // 편집 중인 직원들의 근무일 체크
      for (const s of staff || []) {
        const staffInfo = staffWorkDays.get(s.id)
        if (staffInfo && staffInfo.workDays > avgWorkDays + 3) {
          warnings.push(`⚠️ ${s.name}: 이번 달 과다 근무 (${staffInfo.workDays}일, 평균 ${avgWorkDays.toFixed(1)}일)`)
        }
      }

      // OFF인 직원들 중 너무 적게 일한 사람 체크
      for (const s of offDays || []) {
        const staffInfo = staffWorkDays.get(s.id)
        if (staffInfo && staffInfo.workDays < avgWorkDays - 3) {
          warnings.push(`⚠️ ${s.name}: 이번 달 과소 근무 (${staffInfo.workDays}일, 평균 ${avgWorkDays.toFixed(1)}일) - OFF 배정 재고`)
        }
      }
    }

      // 경고가 있으면 반환 (저장하지 않음)
      if (warnings.length > 0) {
        return successResponse({
          warnings,
          message: '경고 사항이 있습니다. 계속하시겠습니까?',
          requireConfirmation: true
        })
      }
    } // end of !skipValidation

    // dryRun이면 검증만 하고 저장하지 않음
    if (dryRun) {
      return successResponse({
        message: '검증 완료',
        warnings: warnings.length > 0 ? warnings : undefined,
        requireConfirmation: warnings.length > 0
      })
    }

    // ========== 검증 통과, 저장 진행 ==========

    // 1. 스케줄 확인 또는 생성
    let schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        year: year || dateOnly.getFullYear(),
        month: month || (dateOnly.getMonth() + 1)
      }
    })

    if (!schedule) {
      // 스케줄이 없으면 생성
      schedule = await prisma.schedule.create({
        data: {
          clinicId,
          year: year || dateOnly.getFullYear(),
          month: month || (dateOnly.getMonth() + 1),
          status: 'DRAFT'
        }
      })
    }

    // 2. 해당 날짜의 기존 원장 스케줄 삭제
    await prisma.scheduleDoctor.deleteMany({
      where: {
        scheduleId: schedule.id,
        date: dateOnly
      }
    })

    // 3. 새 원장 스케줄 추가
    if (doctors && doctors.length > 0) {
      await prisma.scheduleDoctor.createMany({
        data: doctors.map((doctor: any) => ({
          scheduleId: schedule.id,
          doctorId: doctor.id,
          date: dateOnly,
          hasNightShift: isNightShift || false
        }))
      })
    }

    // 4. 해당 날짜의 기존 직원 배치 삭제
    await prisma.staffAssignment.deleteMany({
      where: {
        scheduleId: schedule.id,
        date: dateOnly
      }
    })

    // 5. 새 직원 배치 추가 (근무자)
    if (staff && staff.length > 0) {
      await prisma.staffAssignment.createMany({
        data: staff.map((s: any) => ({
          scheduleId: schedule.id,
          staffId: s.id,
          date: dateOnly,
          shiftType: isNightShift ? 'NIGHT' : 'DAY'
        }))
      })
    }

    // 5-2. OFF 직원 배치 추가 (StaffAssignment에 저장)
    if (offDays && offDays.length > 0) {
      await prisma.staffAssignment.createMany({
        data: offDays.map((s: any) => ({
          scheduleId: schedule.id,
          staffId: s.id,
          date: dateOnly,
          shiftType: 'OFF'
        }))
      })
    }

    // 6. 해당 날짜의 기존 연차/오프 신청 삭제 (수동으로 생성된 것만)
    await prisma.leaveApplication.deleteMany({
      where: {
        clinicId,
        date: dateOnly,
        status: 'CONFIRMED'
      }
    })

    // 7. 새 연차 신청 추가
    if (annualLeave && annualLeave.length > 0) {
      // ApplicationLink 먼저 생성
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 3) // 3개월 후 만료

      const annualLink = await prisma.applicationLink.create({
        data: {
          clinicId,
          applicationType: 'MANUAL',
          token: `manual_annual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          year: year || dateOnly.getFullYear(),
          month: month || (dateOnly.getMonth() + 1),
          expiresAt
        }
      })

      await prisma.leaveApplication.createMany({
        data: annualLeave.map((s: any) => ({
          clinicId,
          linkId: annualLink.id,
          staffId: s.id,
          date: dateOnly,
          leaveType: 'ANNUAL',
          status: 'CONFIRMED',
          holdReason: '수동 배정'
        }))
      })
    }

    // 8. 새 오프 신청 추가 (수동 배정만 저장, 자동 오프는 저장하지 않음)
    // 오프는 자동으로 계산되므로 수동으로 지정한 오프만 저장
    if (offDays && offDays.length > 0) {
      // 자동 배치 부서의 모든 활성 직원 조회
      const autoAssignDeptNames = await getAutoAssignDepartmentNamesWithFallback(clinicId)
      const allActiveStaff = await prisma.staff.findMany({
        where: {
          clinicId,
          isActive: true,
          departmentName: { in: autoAssignDeptNames }
        },
        select: { id: true }
      })

      const allActiveStaffIds = new Set(allActiveStaff.map(s => s.id))
      const workingStaffIds = new Set(staff?.map((s: any) => s.id) || [])
      const annualLeaveIds = new Set(annualLeave?.map((s: any) => s.id) || [])

      // 자동 오프 계산: 전체 - 근무 - 연차
      const autoOffIds = new Set(
        Array.from(allActiveStaffIds).filter(
          id => !workingStaffIds.has(id) && !annualLeaveIds.has(id)
        )
      )

      // offDays 중에서 자동 오프가 아닌 것만 수동 오프로 저장
      const manualOffDays = offDays.filter((s: any) => !autoOffIds.has(s.id))

      if (manualOffDays.length > 0) {
        // ApplicationLink 먼저 생성
        const expiresAtOff = new Date()
        expiresAtOff.setMonth(expiresAtOff.getMonth() + 3) // 3개월 후 만료

        const offLink = await prisma.applicationLink.create({
          data: {
            clinicId,
            applicationType: 'MANUAL',
            token: `manual_off_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            year: year || dateOnly.getFullYear(),
            month: month || (dateOnly.getMonth() + 1),
            expiresAt: expiresAtOff
          }
        })

        await prisma.leaveApplication.createMany({
          data: manualOffDays.map((s: any) => ({
            clinicId,
            linkId: offLink.id,
            staffId: s.id,
            date: dateOnly,
            leaveType: 'OFF',
            status: 'CONFIRMED',
            holdReason: '수동 배정'
          }))
        })
      }
    }

    console.log('Day schedule saved successfully')

    return successResponse({
      message: 'Schedule saved successfully',
      scheduleId: schedule.id
    })

  } catch (error) {
    console.error('Save day schedule error:', error)
    return errorResponse('Failed to save day schedule', 500)
  }
}
