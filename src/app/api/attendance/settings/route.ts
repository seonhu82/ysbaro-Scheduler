/**
 * 출퇴근 체크 방법 설정 API
 * GET: 현재 설정 조회
 * PUT: 설정 업데이트
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

// 가능한 출퇴근 체크 방법
export const ATTENDANCE_CHECK_METHODS = {
  QR_CODE: 'QR_CODE',
  BIOMETRIC_FINGERPRINT: 'BIOMETRIC_FINGERPRINT',
  BIOMETRIC_FACE: 'BIOMETRIC_FACE',
} as const

export type AttendanceCheckMethod = typeof ATTENDANCE_CHECK_METHODS[keyof typeof ATTENDANCE_CHECK_METHODS]

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    let clinicId: string | undefined = session?.user?.clinicId

    // 세션이 없으면 (공개 접근, 예: 태블릿) 첫 번째 클리닉 사용
    if (!clinicId) {
      const clinic = await prisma.clinic.findFirst({
        select: { id: true }
      })
      clinicId = clinic?.id
    }

    if (!clinicId) {
      // 클리닉이 없으면 기본값 반환
      return successResponse({
        methods: ['QR_CODE', 'BIOMETRIC_FINGERPRINT', 'BIOMETRIC_FACE']
      })
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        attendanceCheckMethods: true,
        useExternalUrlForQR: true
      }
    })

    if (!clinic) {
      // 클리닉을 찾을 수 없으면 기본값 반환
      return successResponse({
        methods: ['QR_CODE', 'BIOMETRIC_FINGERPRINT', 'BIOMETRIC_FACE'],
        useExternalUrlForQR: false
      })
    }

    return successResponse({
      methods: clinic.attendanceCheckMethods || ['QR_CODE', 'BIOMETRIC_FINGERPRINT', 'BIOMETRIC_FACE'],
      useExternalUrlForQR: clinic.useExternalUrlForQR || false
    })
  } catch (error) {
    console.error('Get attendance settings error:', error)
    return errorResponse('Failed to fetch attendance settings', 500)
  }
}

export async function PUT(request: NextRequest) {
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
    const { methods, useExternalUrlForQR } = body

    // 업데이트할 데이터 준비
    const updateData: any = {}

    // methods가 있으면 검증 후 추가
    if (methods !== undefined) {
      // 유효성 검증
      if (!Array.isArray(methods)) {
        return errorResponse('Methods must be an array', 400)
      }

      // 최소 1개 이상의 방법이 선택되어야 함
      if (methods.length === 0) {
        return errorResponse('At least one check method must be enabled', 400)
      }

      // 유효한 방법인지 확인
      const validMethods = Object.values(ATTENDANCE_CHECK_METHODS)
      for (const method of methods) {
        if (!validMethods.includes(method)) {
          return errorResponse(`Invalid check method: ${method}`, 400)
        }
      }

      updateData.attendanceCheckMethods = methods
    }

    // useExternalUrlForQR가 있으면 추가
    if (useExternalUrlForQR !== undefined) {
      updateData.useExternalUrlForQR = useExternalUrlForQR
    }

    // 업데이트할 데이터가 없으면 오류
    if (Object.keys(updateData).length === 0) {
      return errorResponse('No data to update', 400)
    }

    // 업데이트
    const clinic = await prisma.clinic.update({
      where: { id: session.user.clinicId },
      data: updateData,
      select: {
        attendanceCheckMethods: true,
        useExternalUrlForQR: true
      }
    })

    return successResponse({
      methods: clinic.attendanceCheckMethods,
      useExternalUrlForQR: clinic.useExternalUrlForQR
    })
  } catch (error) {
    console.error('Update attendance settings error:', error)
    return errorResponse('Failed to update attendance settings', 500)
  }
}
