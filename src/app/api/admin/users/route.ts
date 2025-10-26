import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isSuperAdmin, isSuperAdminOrAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/users
 * 사용자 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    // 권한 확인
    if (!session?.user || !isSuperAdminOrAdmin((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const role = searchParams.get('role')
    const search = searchParams.get('search')

    // 필터 조건 생성
    const where: any = {}

    if (status && status !== 'all') {
      where.accountStatus = status
    }

    if (role && role !== 'all') {
      where.role = role
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    // ADMIN은 본인 병원만 조회 가능
    if ((session.user as any).role === 'ADMIN') {
      where.clinicId = (session.user as any).clinicId
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        clinic: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { accountStatus: 'asc' }, // PENDING이 먼저
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Users list error:', error)
    return NextResponse.json(
      { error: '사용자 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
