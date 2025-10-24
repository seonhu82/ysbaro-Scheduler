import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token }
    })

    if (!link) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    // 해당 link의 모든 신청 조회
    const applications = await prisma.leaveApplication.findMany({
      where: {
        linkId: link.id
      },
      orderBy: {
        date: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      applications
    })

  } catch (error) {
    console.error('Get my applications error:', error)
    return NextResponse.json(
      { error: 'Failed to get applications' },
      { status: 500 }
    )
  }
}
