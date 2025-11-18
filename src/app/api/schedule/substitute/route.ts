/**
 * 대체 근무 처리 API
 * POST: 스케줄에 없는 직원이 출근했을 때 원래 근무 예정자와 교체
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'
import { updateStaffFairnessScores } from '@/lib/services/fairness-score-update-service'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { date, substituteStaffId, originalStaffId } = body

    if (!date || !substituteStaffId || !originalStaffId) {
      return badRequestResponse('날짜, 대체 근무자, 원래 근무자 정보가 필요합니다')
    }

    const clinicId = session.user.clinicId
    const dateOnly = new Date(date + 'T00:00:00.000Z')
    const year = dateOnly.getFullYear()
    const month = dateOnly.getMonth() + 1

    console.log('📝 [대체 근무] 요청 받음:', {
      date,
      substituteStaffId,
      originalStaffId,
      clinicId
    })

    // 대체 근무자와 원래 근무자 정보 조회
    const [substituteStaff, originalStaff] = await Promise.all([
      prisma.staff.findUnique({
        where: { id: substituteStaffId },
        select: { id: true, name: true, departmentName: true, clinicId: true }
      }),
      prisma.staff.findUnique({
        where: { id: originalStaffId },
        select: { id: true, name: true, departmentName: true, clinicId: true }
      })
    ])

    console.log('👥 [대체 근무] 직원 정보:', {
      substitute: substituteStaff ? `${substituteStaff.name}(${substituteStaff.departmentName})` : 'NOT FOUND',
      original: originalStaff ? `${originalStaff.name}(${originalStaff.departmentName})` : 'NOT FOUND'
    })

    if (!substituteStaff || substituteStaff.clinicId !== clinicId) {
      return badRequestResponse('대체 근무자를 찾을 수 없습니다')
    }

    if (!originalStaff || originalStaff.clinicId !== clinicId) {
      return badRequestResponse('원래 근무자를 찾을 수 없습니다')
    }

    // 해당 날짜의 원래 근무자 스케줄 찾기 (DEPLOYED 또는 DRAFT)
    const originalAssignment = await prisma.staffAssignment.findFirst({
      where: {
        staffId: originalStaffId,
        date: dateOnly,
        schedule: {
          clinicId
        },
        shiftType: {
          not: 'OFF'
        }
      },
      include: {
        schedule: {
          select: {
            id: true,
            year: true,
            month: true,
            status: true
          }
        }
      },
      orderBy: {
        schedule: {
          status: 'desc' // DEPLOYED 우선, 없으면 DRAFT
        }
      }
    })

    console.log('🔍 [대체 근무] 원래 근무자 스케줄:', originalAssignment ? {
      assignmentId: originalAssignment.id,
      scheduleId: originalAssignment.scheduleId,
      shiftType: originalAssignment.shiftType,
      scheduleStatus: originalAssignment.schedule.status
    } : 'NOT FOUND')

    if (!originalAssignment) {
      return badRequestResponse('원래 근무자의 스케줄을 찾을 수 없습니다')
    }

    // 대체 근무자가 이미 스케줄에 있는지 확인
    const existingAssignment = await prisma.staffAssignment.findFirst({
      where: {
        staffId: substituteStaffId,
        date: dateOnly,
        scheduleId: originalAssignment.scheduleId,
        shiftType: {
          not: 'OFF'
        }
      }
    })

    console.log('🔍 [대체 근무] 대체 근무자 기존 배정:', existingAssignment ? '이미 근무 중' : '근무 없음')

    if (existingAssignment) {
      return badRequestResponse('대체 근무자가 이미 해당 날짜 스케줄에 있습니다')
    }

    // 트랜잭션으로 처리
    console.log('🔄 [대체 근무] 트랜잭션 시작...')
    await prisma.$transaction(async (tx) => {
      // 1. 대체 근무자가 이미 OFF로 등록되어 있으면 삭제
      const substituteOffAssignment = await tx.staffAssignment.findFirst({
        where: {
          staffId: substituteStaffId,
          date: dateOnly,
          scheduleId: originalAssignment.scheduleId,
          shiftType: 'OFF'
        }
      })

      if (substituteOffAssignment) {
        console.log('  📌 대체 근무자 기존 OFF 삭제:', substituteOffAssignment.id)
        await tx.staffAssignment.delete({
          where: { id: substituteOffAssignment.id }
        })
      }

      // 2. 원래 근무자의 배정을 대체 근무자로 변경
      console.log('  📌 원래 근무자 배정 수정:', {
        assignmentId: originalAssignment.id,
        from: originalStaffId,
        to: substituteStaffId
      })
      await tx.staffAssignment.update({
        where: { id: originalAssignment.id },
        data: {
          staffId: substituteStaffId,
          isSubstitute: true,
          substituteForStaffId: originalStaffId,
          substitutedAt: new Date()
        }
      })

      // 3. 원래 근무자를 OFF로 변경 (새 레코드 생성)
      console.log('  📌 원래 근무자를 OFF로 생성:', originalStaffId)
      await tx.staffAssignment.create({
        data: {
          scheduleId: originalAssignment.scheduleId,
          staffId: originalStaffId,
          date: dateOnly,
          shiftType: 'OFF'
        }
      })
      console.log('  ✅ 트랜잭션 완료')
    })

    console.log(`✅ [대체 근무] ${substituteStaff.name}(${substituteStaff.departmentName}) ↔ ${originalStaff.name}(${originalStaff.departmentName}) - ${dateOnly.toISOString().split('T')[0]}`)

    // 형평성 점수 업데이트 (에러가 발생해도 대체 처리는 성공으로 처리)
    try {
      await updateStaffFairnessScores(clinicId, year, month)
      console.log('✅ 형평성 점수 업데이트 완료')
    } catch (fairnessError) {
      console.error('⚠️ 형평성 점수 업데이트 실패 (무시):', fairnessError)
    }

    return successResponse({
      message: '대체 근무 처리가 완료되었습니다',
      substitute: {
        id: substituteStaff.id,
        name: substituteStaff.name,
        department: substituteStaff.departmentName
      },
      original: {
        id: originalStaff.id,
        name: originalStaff.name,
        department: originalStaff.departmentName
      }
    })

  } catch (error: any) {
    console.error('❌ [대체 근무] 처리 실패:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    })
    return errorResponse(
      error.message || '대체 근무 처리에 실패했습니다',
      500
    )
  }
}
