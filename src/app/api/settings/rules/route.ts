/**
 * 근무 규칙 설정 API
 * GET: 규칙 조회
 * PATCH: 규칙 업데이트
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    // RuleSettings 조회 (없으면 기본값으로 생성)
    let ruleSettings = await prisma.ruleSettings.findUnique({
      where: {
        clinicId: session.user.clinicId
      }
    })

    if (!ruleSettings) {
      // 기본 규칙 생성
      ruleSettings = await prisma.ruleSettings.create({
        data: {
          clinicId: session.user.clinicId,
          weekBusinessDays: 6,
          defaultWorkDays: 4,
          maxWeeklyOffs: 2,
          preventSundayOff: true,
          preventHolidayOff: true,
          maxConsecutiveNights: 3,
          minRestAfterNight: 1
        }
      })
    }

    return successResponse(ruleSettings)
  } catch (error) {
    console.error('Get rule settings error:', error)
    return errorResponse('Failed to fetch rule settings', 500)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const {
      weekBusinessDays,
      defaultWorkDays,
      maxWeeklyOffs,
      preventSundayOff,
      preventHolidayOff,
      maxConsecutiveNights,
      minRestAfterNight
    } = body

    // upsert로 생성 또는 업데이트
    const ruleSettings = await prisma.ruleSettings.upsert({
      where: {
        clinicId: session.user.clinicId
      },
      create: {
        clinicId: session.user.clinicId,
        weekBusinessDays: weekBusinessDays ?? 6,
        defaultWorkDays: defaultWorkDays ?? 4,
        maxWeeklyOffs: maxWeeklyOffs ?? 2,
        preventSundayOff: preventSundayOff ?? true,
        preventHolidayOff: preventHolidayOff ?? true,
        maxConsecutiveNights: maxConsecutiveNights ?? 3,
        minRestAfterNight: minRestAfterNight ?? 1
      },
      update: {
        weekBusinessDays,
        defaultWorkDays,
        maxWeeklyOffs,
        preventSundayOff,
        preventHolidayOff,
        maxConsecutiveNights,
        minRestAfterNight
      }
    })

    return successResponse(ruleSettings, 'Rule settings updated successfully')
  } catch (error) {
    console.error('Update rule settings error:', error)
    return errorResponse('Failed to update rule settings', 500)
  }
}
