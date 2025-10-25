/**
 * 근무 형태 설정 API
 * GET: 현재 설정 조회
 * PATCH: 설정 수정
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 클리닉의 RuleSettings 조회
    const ruleSettings = await prisma.ruleSettings.findUnique({
      where: { clinicId: session.user.clinicId }
    })

    if (!ruleSettings) {
      return NextResponse.json(
        { error: 'Rule settings not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        weekBusinessDays: ruleSettings.weekBusinessDays,
        defaultWorkDays: ruleSettings.defaultWorkDays,
        maxWeeklyOffs: ruleSettings.maxWeeklyOffs,
        maxConsecutiveNights: ruleSettings.maxConsecutiveNights,
        minRestAfterNight: ruleSettings.minRestAfterNight
      }
    })
  } catch (error) {
    console.error('GET work-type settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      weekBusinessDays,
      defaultWorkDays,
      maxWeeklyOffs,
      maxConsecutiveNights,
      minRestAfterNight
    } = body

    // RuleSettings 업데이트
    const updatedSettings = await prisma.ruleSettings.update({
      where: { clinicId: session.user.clinicId },
      data: {
        ...(weekBusinessDays !== undefined && { weekBusinessDays }),
        ...(defaultWorkDays !== undefined && { defaultWorkDays }),
        ...(maxWeeklyOffs !== undefined && { maxWeeklyOffs }),
        ...(maxConsecutiveNights !== undefined && { maxConsecutiveNights }),
        ...(minRestAfterNight !== undefined && { minRestAfterNight })
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedSettings
    })
  } catch (error) {
    console.error('PATCH work-type settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
