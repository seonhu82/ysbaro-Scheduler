import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/fairness/current-scores
 * 현재 형평성 점수 조회 (이번 달)
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

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // 이번 달 형평성 점수 조회
    const scores = await prisma.fairnessScore.findMany({
      where: {
        staff: {
          clinicId,
        },
        year,
        month,
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        staff: {
          name: 'asc',
        },
      },
    })

    const result = scores.map((score) => ({
      staffId: score.staffId,
      staffName: score.staff.name,
      nightShiftCount: score.nightShiftCount,
      weekendCount: score.weekendCount,
      holidayCount: score.holidayCount,
      holidayAdjacentCount: score.holidayAdjacentCount,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Current scores error:', error)
    return NextResponse.json(
      { error: '현재 점수 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
