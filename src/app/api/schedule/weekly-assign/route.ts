/**
 * 주간 자동 배치 API
 *
 * POST /api/schedule/weekly-assign
 * - weekInfoId를 받아 해당 주차의 직원 배치를 자동으로 수행
 * - 형평성 설정 기반 선택적 적용
 * - 주4일/주5일 근무 보장
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { autoAssignWeeklySchedule } from '@/lib/algorithms/weekly-assign-v2'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'
import { prisma } from '@/lib/prisma'
import { weeklyAssignSchema, validateSchema, validationErrorResponse } from '@/lib/validation/schemas'
import { notifyAssignmentComplete } from '@/lib/services/notification-helper'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await auth()

    if (!session?.user) {
      return unauthorizedResponse()
    }

    // 권한 확인 (ADMIN 또는 MANAGER만 가능)
    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return errorResponse('권한이 없습니다', 403)
    }

    // 요청 데이터 파싱 및 검증
    const body = await request.json()
    const validation = validateSchema(weeklyAssignSchema, body)

    if (!validation.success) {
      return NextResponse.json(validationErrorResponse(validation.errors), { status: 400 })
    }

    const { weekInfoId } = validation.data

    console.log(`\n========== 주간 자동 배치 시작 ==========`)
    console.log(`WeekInfo ID: ${weekInfoId}`)
    console.log(`요청자: ${session.user.name} (${session.user.role})`)
    console.log(`시작 시간: ${new Date().toLocaleString('ko-KR')}`)

    // 🔒 동시성 제어: WeekInfo 상태 확인 및 잠금
    // 다른 배치가 진행 중이면 차단
    let lockAcquired = false

    try {
      await prisma.$transaction(async (tx) => {
        // WeekInfo 조회 및 상태 확인
        const weekInfo = await tx.weekInfo.findUnique({
          where: { id: weekInfoId },
          select: { id: true, status: true, clinicId: true }
        })

        if (!weekInfo) {
          throw new Error('해당 주차 정보를 찾을 수 없습니다')
        }

        // 병원 권한 확인
        if (weekInfo.clinicId !== session.user.clinicId) {
          throw new Error('권한이 없는 주차입니다')
        }

        // 이미 배치 진행 중이면 차단
        if (weekInfo.status === 'ASSIGNING') {
          throw new Error('ALREADY_ASSIGNING')
        }

        // 상태를 ASSIGNING으로 변경 (락 획득)
        await tx.weekInfo.update({
          where: { id: weekInfoId },
          data: {
            status: 'ASSIGNING',
            updatedAt: new Date()
          }
        })

        lockAcquired = true
        console.log(`✅ 배치 락 획득 성공`)
      })
    } catch (error: any) {
      if (error.message === 'ALREADY_ASSIGNING') {
        console.warn(`⚠️ 이미 다른 배치가 진행 중입니다: ${weekInfoId}`)
        return errorResponse(
          '이미 다른 배치가 진행 중입니다. 잠시 후 다시 시도해주세요.',
          409
        )
      }
      throw error
    }

    // 주간 배치 실행
    let result
    try {
      result = await autoAssignWeeklySchedule(weekInfoId)
    } finally {
      // 배치 완료 후 상태 복원 (락 해제)
      // autoAssignWeeklySchedule 내부에서 상태를 COMPLETED/DRAFT로 변경하므로
      // 여기서는 ASSIGNING 상태가 남아있을 경우에만 DRAFT로 복원
      if (lockAcquired) {
        try {
          await prisma.weekInfo.updateMany({
            where: {
              id: weekInfoId,
              status: 'ASSIGNING' // 아직 ASSIGNING 상태면
            },
            data: {
              status: 'DRAFT',
              updatedAt: new Date()
            }
          })
        } catch (cleanupError) {
          console.error('상태 복원 실패 (무시):', cleanupError)
        }
      }
    }

    console.log(`\n========== 주간 자동 배치 완료 ==========`)
    console.log(`성공 여부: ${result.success ? '✅ 성공' : '❌ 실패'}`)
    console.log(`배치 인원: ${result.assignedCount}명`)
    console.log(`미해결 이슈: ${result.unresolvedIssues.length}건`)
    console.log(`완료 시간: ${new Date().toLocaleString('ko-KR')}`)

    if (result.unresolvedIssues.length > 0) {
      console.log(`\n미해결 이슈 목록:`)
      result.unresolvedIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity}] ${issue.message}`)
        if (issue.suggestion) {
          console.log(`     → ${issue.suggestion}`)
        }
      })
    }

    // 🔔 배치 완료 알림 전송 (비동기, 실패해도 무시)
    try {
      const adminUsers = await prisma.user.findMany({
        where: {
          clinicId: session.user.clinicId,
          role: { in: ['ADMIN', 'MANAGER'] },
          accountStatus: 'APPROVED'
        },
        select: { id: true }
      })

      if (adminUsers.length > 0) {
        await notifyAssignmentComplete(
          adminUsers.map(u => u.id),
          weekInfoId,
          result.assignedCount,
          result.unresolvedIssues.length
        )
        console.log(`📬 배치 완료 알림 전송: ${adminUsers.length}명`)
      }
    } catch (notificationError) {
      console.error('알림 전송 실패 (무시):', notificationError)
    }

    return successResponse({
      ...result,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('주간 배치 API 오류:', error)

    return errorResponse(
      error.message || '주간 배치 중 오류가 발생했습니다',
      500
    )
  }
}
