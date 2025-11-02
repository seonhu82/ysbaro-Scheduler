import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const status = searchParams.get('status')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month are required' },
        { status: 400 }
      )
    }

    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(month), 0)

    const whereClause: any = {
      clinicId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    }

    if (status) {
      whereClause.status = status
    }

    const applications = await prisma.leaveApplication.findMany({
      where: whereClause,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // 형식 변환
    const formattedApplications = applications.map((app) => ({
      id: app.id,
      staffName: app.staff?.name || '',
      date: app.date.toISOString().split('T')[0],
      leaveType: app.leaveType,
      status: app.status,
    }))

    return NextResponse.json({
      success: true,
      applications: formattedApplications,
    })
  } catch (error) {
    console.error('GET /api/leave-management/list error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
