import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/fairness
 * 형평성 설정 조회
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const clinicId = user.clinicId

    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 400 })
    }

    let settings = await prisma.fairnessSettings.findUnique({
      where: { clinicId },
    })

    // 설정이 없으면 기본값 생성
    if (!settings) {
      settings = await prisma.fairnessSettings.create({
        data: {
          clinicId,
          enableNightShiftFairness: true,
          enableWeekendFairness: true,
          enableHolidayFairness: true,
          enableHolidayAdjacentFairness: false,
          fairnessThreshold: 0.2,
          nightShiftWeight: 1.5,
          weekendWeight: 1.0,
          holidayWeight: 2.0,
          holidayAdjacentWeight: 0.5,
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Fairness settings get error:', error)
    return NextResponse.json(
      { error: '형평성 설정 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/fairness
 * 형평성 설정 저장
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || !hasAdminPrivileges((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const user = session.user as any
    const clinicId = user.clinicId

    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic not found' }, { status: 400 })
    }

    const data = await request.json()

    const settings = await prisma.fairnessSettings.upsert({
      where: { clinicId },
      update: data,
      create: {
        clinicId,
        ...data,
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Fairness settings save error:', error)
    return NextResponse.json(
      { error: '형평성 설정 저장 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
