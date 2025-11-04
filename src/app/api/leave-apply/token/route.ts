/**
 * 연차/오프 신청 토큰 조회 API
 * GET /api/leave-apply/token
 *
 * 가장 최근 활성화된 연차/오프 신청 토큰을 반환합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 가장 최근의 ACTIVE 상태 ApplicationLink 찾기
    const latestLink = await prisma.applicationLink.findFirst({
      where: {
        clinicId: session.user.clinicId,
        staffId: null, // 전체 직원용 링크만
        status: 'ACTIVE',
        expiresAt: {
          gte: new Date() // 만료되지 않은 것만
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    if (!latestLink) {
      return NextResponse.json(
        { success: false, error: 'No active application period found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      token: latestLink.token,
      year: latestLink.year,
      month: latestLink.month,
      expiresAt: latestLink.expiresAt
    })
  } catch (error) {
    console.error('Leave apply token error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get leave apply token' },
      { status: 500 }
    )
  }
}
