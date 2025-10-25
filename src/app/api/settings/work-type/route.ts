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
        week4WorkDays: ruleSettings.week4WorkDays,
        week4OffDays: ruleSettings.week4OffDays,
        week5WorkDays: ruleSettings.week5WorkDays,
        week5OffDays: ruleSettings.week5OffDays,
        maxConsecutiveWorkDays: ruleSettings.maxConsecutiveWorkDays,
        maxWeeklyOffs: ruleSettings.maxWeeklyOffs
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
      week4WorkDays,
      week4OffDays,
      week5WorkDays,
      week5OffDays,
      maxConsecutiveWorkDays,
      maxWeeklyOffs
    } = body

    // 입력 검증
    if (week4WorkDays !== undefined && week4OffDays !== undefined) {
      if (week4WorkDays + week4OffDays !== weekBusinessDays) {
        return NextResponse.json(
          { error: 'Week 4 work days + off days must equal business days' },
          { status: 400 }
        )
      }
    }

    if (week5WorkDays !== undefined && week5OffDays !== undefined) {
      if (week5WorkDays + week5OffDays !== weekBusinessDays) {
        return NextResponse.json(
          { error: 'Week 5 work days + off days must equal business days' },
          { status: 400 }
        )
      }
    }

    // RuleSettings 업데이트
    const updatedSettings = await prisma.ruleSettings.update({
      where: { clinicId: session.user.clinicId },
      data: {
        ...(weekBusinessDays !== undefined && { weekBusinessDays }),
        ...(week4WorkDays !== undefined && { week4WorkDays }),
        ...(week4OffDays !== undefined && { week4OffDays }),
        ...(week5WorkDays !== undefined && { week5WorkDays }),
        ...(week5OffDays !== undefined && { week5OffDays }),
        ...(maxConsecutiveWorkDays !== undefined && { maxConsecutiveWorkDays }),
        ...(maxWeeklyOffs !== undefined && { maxWeeklyOffs })
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
