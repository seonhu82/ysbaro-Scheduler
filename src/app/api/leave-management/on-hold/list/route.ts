/**
 * ON_HOLD 신청 목록 조회 API
 * GET /api/leave-management/on-hold/list
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateStaffFairnessV2 } from '@/lib/services/fairness-calculator-v2'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '')
    const month = parseInt(searchParams.get('month') || '')

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    const applications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        status: 'ON_HOLD',
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0)
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            categoryName: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // 형평성 점수 계산
    const applicationsWithFairness = await Promise.all(
      applications.map(async (app) => {
        const appDate = new Date(app.date)
        const fairness = await calculateStaffFairnessV2(
          app.staffId,
          clinicId,
          appDate.getFullYear(),
          appDate.getMonth() + 1
        )

        return {
          id: app.id,
          staffName: app.staff.name,
          categoryName: app.staff.categoryName || 'Unknown',
          date: app.date.toISOString(),
          leaveType: app.leaveType,
          holdReason: app.holdReason || 'Unknown',
          fairnessScore: fairness.overallScore,
          createdAt: app.createdAt.toISOString()
        }
      })
    )

    return NextResponse.json({
      success: true,
      applications: applicationsWithFairness
    })

  } catch (error) {
    console.error('ON_HOLD list error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ON_HOLD applications' },
      { status: 500 }
    )
  }
}
