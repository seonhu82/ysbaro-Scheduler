import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hasAdminPrivileges } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * 요일 문자열을 숫자로 변환
 */
function getDayOfWeekNumber(dayOfWeek: string): number {
  const dayMap: Record<string, number> = {
    'SUNDAY': 0,
    'MONDAY': 1,
    'TUESDAY': 2,
    'WEDNESDAY': 3,
    'THURSDAY': 4,
    'FRIDAY': 5,
    'SATURDAY': 6
  }
  return dayMap[dayOfWeek] ?? 0
}

/**
 * GET /api/settings/weekly-patterns
 * 주간 패턴 목록 조회
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

    const patterns = await prisma.weeklyPattern.findMany({
      where: { clinicId },
      include: {
        days: {
          include: {
            combination: true,
          },
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 디버깅: Prisma 결과 확인
    if (patterns.length > 0) {
      console.log('First pattern from Prisma:', JSON.stringify({
        id: patterns[0].id,
        name: patterns[0].name,
        days: patterns[0].days.map(d => ({
          dayOfWeek: d.dayOfWeek,
          combinationId: d.combinationId,
          combination: d.combination
        }))
      }, null, 2))
    }

    // 두 가지 형식 모두 반환 (관리 페이지용 + 배치 페이지용)
    const formattedPatterns = patterns.map(pattern => ({
      id: pattern.id,
      name: pattern.name,
      description: pattern.description,
      isActive: pattern.isActive,
      isDefault: pattern.isDefault,
      // 주간 패턴 관리 페이지용 (원본 형식)
      days: pattern.days,
      // 원장 스케줄 배치 페이지용 (숫자 형식)
      dailyPatternCount: pattern.days.length,
      dailyPatterns: pattern.days.map(day => ({
        dayOfWeek: getDayOfWeekNumber(day.dayOfWeek),
        combination: day.combination ? {
          name: day.combination.name,
          doctors: day.combination.doctors,
          hasNightShift: day.combination.hasNightShift
        } : null
      }))
    }))

    // 디버깅: 첫 번째 패턴 상세 로그
    if (formattedPatterns.length > 0) {
      console.log('First pattern dailyPatterns:', JSON.stringify(formattedPatterns[0].dailyPatterns, null, 2))
    }

    return NextResponse.json(formattedPatterns)
  } catch (error) {
    console.error('Weekly patterns list error:', error)
    return NextResponse.json(
      { error: '주간 패턴 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/weekly-patterns
 * 주간 패턴 생성
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

    const { name, description, days } = await request.json()

    // 디버깅: 받은 데이터 확인
    console.log('Creating weekly pattern:', { name, description })
    console.log('Days data:', JSON.stringify(days, null, 2))

    // 패턴 생성
    const pattern = await prisma.weeklyPattern.create({
      data: {
        clinicId,
        name,
        description,
        days: {
          create: days.map((day: any) => ({
            dayOfWeek: day.dayOfWeek,
            combinationId: day.combinationId || null,
            isClosedDay: day.isClosedDay || false,
          })),
        },
      },
      include: {
        days: {
          include: {
            combination: true,
          },
        },
      },
    })

    return NextResponse.json(pattern)
  } catch (error) {
    console.error('Weekly pattern creation error:', error)
    return NextResponse.json(
      { error: '주간 패턴 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
