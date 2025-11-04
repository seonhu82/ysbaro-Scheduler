import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/leave-management/period/[id]/applications
 * 특정 신청 기간의 신청 내역 조회
 */
export async function GET(
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

    // ApplicationLink 조회 (권한 확인용)
    const applicationLink = await prisma.applicationLink.findUnique({
      where: { id }
    })

    if (!applicationLink) {
      return NextResponse.json(
        { success: false, error: 'Period not found' },
        { status: 404 }
      )
    }

    if (applicationLink.clinicId !== session.user.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // 해당 기간의 신청 내역 조회
    const applications = await prisma.leaveApplication.findMany({
      where: {
        applicationLinkId: id
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            departmentName: true,
            categoryName: true
          }
        }
      },
      orderBy: [
        { date: 'asc' },
        { staff: { name: 'asc' } }
      ]
    })

    return NextResponse.json({ success: true, data: applications })
  } catch (error) {
    console.error('GET /api/leave-management/period/[id]/applications error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch applications' },
      { status: 500 }
    )
  }
}
