import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const monthFilter = searchParams.get('month') // YYYY-MM 형식

    const where: any = {
      clinicId: session.user.clinicId
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (monthFilter) {
      const [year, month] = monthFilter.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      where.date = {
        gte: startDate,
        lte: endDate
      }
    }

    const applications = await prisma.leaveApplication.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true,
            email: true
          }
        },
        link: {
          select: {
            id: true,
            year: true,
            month: true,
            token: true,
            status: true
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return successResponse(applications)
  } catch (error) {
    console.error('List view error:', error)
    return errorResponse('Failed to fetch list data', 500)
  }
}
