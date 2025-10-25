/**
 * 공개 스케줄 조회 인증 API
 * POST: 생년월일 또는 PIN으로 직원 인증
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'
import bcrypt from 'bcryptjs'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const body = await request.json()
    const { authType, staffName, birthdate, pin } = body

    // 토큰 유효성 확인
    const scheduleViewLink = await prisma.scheduleViewLink.findUnique({
      where: { token },
      include: {
        clinic: {
          select: { id: true }
        }
      }
    })

    if (!scheduleViewLink) {
      return unauthorizedResponse('Invalid token')
    }

    // 만료 확인
    if (scheduleViewLink.expiresAt && scheduleViewLink.expiresAt < new Date()) {
      return unauthorizedResponse('Token has expired')
    }

    // 직원 찾기
    const staff = await prisma.staff.findFirst({
      where: {
        clinicId: scheduleViewLink.clinicId,
        name: staffName,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        birthDateStr: true,
        pin: true
      }
    })

    if (!staff) {
      return errorResponse('직원을 찾을 수 없습니다', 404)
    }

    // 인증 방식에 따라 처리
    if (authType === 'birthdate') {
      // 생년월일 인증
      if (!staff.birthDateStr) {
        return errorResponse('생년월일 정보가 등록되지 않았습니다', 400)
      }

      if (staff.birthDateStr !== birthdate) {
        return errorResponse('생년월일이 일치하지 않습니다', 401)
      }

      return successResponse({
        staffId: staff.id,
        staffName: staff.name,
        authMethod: 'birthdate'
      })
    } else if (authType === 'pin') {
      // PIN 인증
      if (!staff.pin) {
        return errorResponse('PIN이 설정되지 않았습니다. 생년월일로 인증해주세요.', 400)
      }

      const pinMatch = await bcrypt.compare(pin, staff.pin)
      if (!pinMatch) {
        return errorResponse('PIN이 일치하지 않습니다', 401)
      }

      return successResponse({
        staffId: staff.id,
        staffName: staff.name,
        authMethod: 'pin'
      })
    } else {
      return errorResponse('Invalid authentication type', 400)
    }
  } catch (error) {
    console.error('Schedule view auth error:', error)
    return errorResponse('Authentication failed', 500)
  }
}
