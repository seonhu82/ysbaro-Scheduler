/**
 * 의심 패턴 감지 설정 API
 * 경로: /api/attendance/detection-settings
 *
 * 기능:
 * - GET: 의심 패턴 감지 설정 조회
 * - POST: 의심 패턴 감지 설정 저장
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// 성공 응답 헬퍼
function successResponse(data: any) {
  return NextResponse.json({ success: true, data })
}

// 에러 응답 헬퍼
function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

// GET: 의심 패턴 감지 설정 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return errorResponse('인증되지 않은 사용자입니다', 401)
    }

    const clinicId = session.user.clinicId

    // 기존 설정 조회
    let settings = await prisma.suspiciousPatternSettings.findUnique({
      where: { clinicId }
    })

    // 설정이 없으면 기본값 생성
    if (!settings) {
      settings = await prisma.suspiciousPatternSettings.create({
        data: {
          clinicId,
          lateThresholdMinutes: 10,
          earlyLeaveThresholdMinutes: 10,
          repeatCheckThresholdMinutes: 5,
          detectUnscheduledCheckIn: true,
          consecutiveLateThreshold: 3,
          consecutiveEarlyLeaveThreshold: 3,
          enableNotifications: true
        }
      })
    }

    return successResponse({ settings })

  } catch (error: any) {
    console.error('의심 패턴 감지 설정 조회 오류:', error)
    return errorResponse('설정 조회 중 오류가 발생했습니다')
  }
}

// POST: 의심 패턴 감지 설정 저장
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return errorResponse('인증되지 않은 사용자입니다', 401)
    }

    const clinicId = session.user.clinicId
    const body = await request.json()

    const {
      lateThresholdMinutes,
      earlyLeaveThresholdMinutes,
      repeatCheckThresholdMinutes,
      detectUnscheduledCheckIn,
      consecutiveLateThreshold,
      consecutiveEarlyLeaveThreshold,
      enableNotifications
    } = body

    // 유효성 검사
    if (lateThresholdMinutes < 0 || lateThresholdMinutes > 120) {
      return errorResponse('지각 허용 시간은 0-120분 사이여야 합니다')
    }

    if (earlyLeaveThresholdMinutes < 0 || earlyLeaveThresholdMinutes > 120) {
      return errorResponse('조퇴 기준 시간은 0-120분 사이여야 합니다')
    }

    if (repeatCheckThresholdMinutes < 0 || repeatCheckThresholdMinutes > 60) {
      return errorResponse('반복 출퇴근 감지 시간은 0-60분 사이여야 합니다')
    }

    if (consecutiveLateThreshold < 1 || consecutiveLateThreshold > 30) {
      return errorResponse('연속 지각 알림 기준은 1-30일 사이여야 합니다')
    }

    if (consecutiveEarlyLeaveThreshold < 1 || consecutiveEarlyLeaveThreshold > 30) {
      return errorResponse('연속 조퇴 알림 기준은 1-30일 사이여야 합니다')
    }

    // 설정 업데이트
    const settings = await prisma.suspiciousPatternSettings.upsert({
      where: { clinicId },
      update: {
        lateThresholdMinutes,
        earlyLeaveThresholdMinutes,
        repeatCheckThresholdMinutes,
        detectUnscheduledCheckIn,
        consecutiveLateThreshold,
        consecutiveEarlyLeaveThreshold,
        enableNotifications
      },
      create: {
        clinicId,
        lateThresholdMinutes,
        earlyLeaveThresholdMinutes,
        repeatCheckThresholdMinutes,
        detectUnscheduledCheckIn,
        consecutiveLateThreshold,
        consecutiveEarlyLeaveThreshold,
        enableNotifications
      }
    })

    return successResponse({
      message: '의심 패턴 감지 설정이 저장되었습니다',
      settings
    })

  } catch (error: any) {
    console.error('의심 패턴 감지 설정 저장 오류:', error)
    return errorResponse('설정 저장 중 오류가 발생했습니다')
  }
}
