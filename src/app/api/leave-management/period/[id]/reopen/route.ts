import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/leave-management/period/[id]/reopen
 * 신청 기간 재오픈
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params
    const clinicId = session.user.clinicId

    // ApplicationLink 조회
    const applicationLink = await prisma.applicationLink.findUnique({
      where: { id }
    })

    if (!applicationLink) {
      return NextResponse.json(
        { success: false, error: 'Period not found' },
        { status: 404 }
      )
    }

    if (applicationLink.clinicId !== clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // 재오픈 처리
    const updated = await prisma.applicationLink.update({
      where: { id },
      data: {
        status: 'ACTIVE'
      }
    })

    console.log(`✅ 신청기간 재오픈: ${applicationLink.year}년 ${applicationLink.month}월`)

    return NextResponse.json({
      success: true,
      data: updated,
      message: '신청 기간이 재오픈되었습니다.'
    })

  } catch (error: any) {
    console.error('POST /api/leave-management/period/[id]/reopen error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reopen period' },
      { status: 500 }
    )
  }
}
