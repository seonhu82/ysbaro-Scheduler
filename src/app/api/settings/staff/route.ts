import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/staff
 * 직원 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const department = searchParams.get('department')
    const isActive = searchParams.get('isActive')
    const autoAssignOnly = searchParams.get('autoAssignOnly') === 'true'

    const clinicId = session.user.clinicId

    // 자동배치 부서만 필터링하는 경우
    let departmentNames: string[] | undefined
    if (autoAssignOnly) {
      const autoAssignDepts = await prisma.department.findMany({
        where: {
          clinicId,
          useAutoAssignment: true
        },
        select: {
          name: true
        }
      })
      departmentNames = autoAssignDepts.map(d => d.name)
    }

    const where: any = {
      clinicId
    }

    if (department) {
      where.departmentName = department
    } else if (departmentNames && departmentNames.length > 0) {
      where.departmentName = { in: departmentNames }
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const staff = await prisma.staff.findMany({
      where,
      orderBy: [
        { departmentName: 'asc' },
        { categoryName: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        rank: true,
        categoryName: true,
        departmentName: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({ success: true, data: staff })
  } catch (error) {
    console.error('GET /api/settings/staff error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch staff' },
      { status: 500 }
    )
  }
}
