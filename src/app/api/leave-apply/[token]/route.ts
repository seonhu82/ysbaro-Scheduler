// 연차 신청 링크 정보 조회

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
      include: {
        slotLimits: {
          orderBy: { date: 'asc' },
        },
        clinic: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: 'Invalid link' },
        { status: 404 }
      )
    }

    // 링크 상태 확인
    if (link.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Link is not active' },
        { status: 400 }
      )
    }

    // 만료 확인
    if (new Date() > link.expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Link has expired' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: link.id,
        year: link.year,
        month: link.month,
        expiresAt: link.expiresAt,
        clinicName: link.clinic.name,
        slotLimits: link.slotLimits,
      },
    })
  } catch (error) {
    console.error('GET /api/leave-apply/[token] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
