import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/combinations
 * 의사 조합 목록 조회
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

    const combinations = await prisma.doctorCombination.findMany({
      where: { clinicId },
      orderBy: [{ dayOfWeek: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: combinations,
    })
  } catch (error) {
    console.error('Combinations list error:', error)
    return NextResponse.json(
      { error: '조합 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/combinations
 * 의사 조합 생성
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

    const combination = await prisma.doctorCombination.create({
      data: {
        clinicId,
        ...data,
      },
    })

    return NextResponse.json(combination)
  } catch (error) {
    console.error('Combination creation error:', error)
    return NextResponse.json(
      { error: '조합 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
