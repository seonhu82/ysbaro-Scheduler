import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/leave-management/filter-options
 * 직원 필터링을 위한 동적 옵션 조회 (부서, 구분)
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

    const clinicId = session.user.clinicId

    // 부서 목록 조회 (활성 직원이 있는 부서만)
    const departments = await prisma.staff.groupBy({
      by: ['departmentName'],
      where: {
        clinicId,
        isActive: true,
        departmentName: { not: null }
      },
      _count: {
        id: true
      },
      orderBy: {
        departmentName: 'asc'
      }
    })

    // 구분 목록 조회 (활성 직원이 있는 구분만)
    const categories = await prisma.staff.groupBy({
      by: ['categoryName'],
      where: {
        clinicId,
        isActive: true,
        categoryName: { not: null }
      },
      _count: {
        id: true
      },
      orderBy: {
        categoryName: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        departments: departments.map(d => ({
          name: d.departmentName,
          count: d._count.id
        })),
        categories: categories.map(c => ({
          name: c.categoryName,
          count: c._count.id
        }))
      }
    })
  } catch (error) {
    console.error('Filter options error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch filter options' },
      { status: 500 }
    )
  }
}
