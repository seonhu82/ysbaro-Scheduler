import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/category-ratios
 * 구분별 비율 설정 조회
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

    // 구분 목록 조회
    const categories = await prisma.staffCategory.findMany({
      where: { clinicId },
      orderBy: { priority: 'asc' },
    })

    // 비율 설정 조회
    let ratioSettings = await prisma.categoryRatioSettings.findUnique({
      where: { clinicId },
    })

    // 설정이 없으면 기본값 생성 (균등 분배)
    if (!ratioSettings) {
      const defaultRatios: any = {}
      const equalRatio = categories.length > 0 ? Math.floor(100 / categories.length) : 0
      let remainder = 100 - (equalRatio * categories.length)

      categories.forEach((cat, index) => {
        defaultRatios[cat.id] = equalRatio + (index === 0 ? remainder : 0)
      })

      ratioSettings = await prisma.categoryRatioSettings.create({
        data: {
          clinicId,
          ratios: defaultRatios,
        },
      })
    }

    return NextResponse.json({
      categories,
      ratios: ratioSettings.ratios,
    })
  } catch (error) {
    console.error('Category ratios get error:', error)
    return NextResponse.json(
      { error: '구분별 비율 설정 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/category-ratios
 * 구분별 비율 설정 저장
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

    const { ratios } = await request.json()

    // 합계 검증
    const total = Object.values(ratios).reduce(
      (sum: number, val: any) => sum + (typeof val === 'number' ? val : 0),
      0
    )

    if (total !== 100) {
      return NextResponse.json(
        { error: '비율 합계가 100%가 되어야 합니다' },
        { status: 400 }
      )
    }

    const settings = await prisma.categoryRatioSettings.upsert({
      where: { clinicId },
      update: { ratios },
      create: {
        clinicId,
        ratios,
      },
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Category ratios save error:', error)
    return NextResponse.json(
      { error: '구분별 비율 설정 저장 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
